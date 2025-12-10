import { WebSocketServer } from 'ws';
import createLogger, { LogLevel, Logger } from '@openfn/logger';
import type { Server } from 'http';
import type {
  RunStartPayload,
  RunStartReply,
  RunCompletePayload,
  RunCompleteReply,
  RunLogPayload,
  RunLogReply,
  ClaimRun,
  ClaimPayload,
  ClaimReply,
  GetPlanPayload,
  GetPlanReply,
  GetCredentialPayload,
  GetCredentialReply,
  GetDataclipPayload,
  GetDataClipReply,
  StepCompletePayload,
  StepCompleteReply,
  StepStartPayload,
  StepStartReply,
  LegacyRunLogPayload,
} from '@openfn/lexicon/lightning';

import createPheonixMockSocketServer, {
  DevSocket,
  PhoenixEvent,
  PhoenixEventStatus,
} from './socket-server';
import {
  RUN_COMPLETE,
  RUN_LOG,
  RUN_START,
  CLAIM,
  GET_PLAN,
  GET_CREDENTIAL,
  GET_DATACLIP,
  STEP_COMPLETE,
  STEP_START,
} from './events';
import { generateRunToken } from './tokens';
import { extractRunId, stringify } from './util';
import type { ServerState } from './server';

// dumb cloning id
// just an idea for unit tests
const clone = (state: ServerState) => {
  const { events, ...rest } = state;
  return JSON.parse(JSON.stringify(rest));
};

const enc = new TextEncoder();

const validateReasons = (evt: any) => {
  const { reason, error_message, error_type } = evt;
  if (!reason) {
    return {
      status: 'error',
      response: `No exit reason`,
    };
  } else if (!/^(success|fail|crash|exception|kill)$/.test(reason)) {
    return {
      status: 'error',
      response: `Unrecognised reason ${reason}`,
    };
  } else if (reason === 'success' && (error_type || error_message)) {
    return {
      status: 'error',
      response: `Inconsistent reason (success and error type or message)`,
    };
  }
  return { status: 'ok' };
};

// this new API is websocket based
// Events map to handlers
// can I even implement this in JS? Not with pheonix anyway. hmm.
// dead at the first hurdle really.
// what if I do the server side mock in koa, can I use the pheonix client to connect?
const createSocketAPI = (
  state: ServerState,
  path: string,
  httpServer: Server,
  logger?: Logger,
  logLevel?: LogLevel,
  socketDelay = 1
) => {
  // set up a websocket server to listen to connections
  const server = new WebSocketServer({
    server: httpServer,

    // Note: phoenix websocket will connect to <endpoint>/websocket
    path: path ? `${path}/websocket` : undefined,
  });

  // pass that through to the phoenix mock
  const wss = createPheonixMockSocketServer({
    // @ts-ignore server typings
    server,
    state,
    logger: logger && createLogger('PHX', { level: logLevel }),
    socketDelay: socketDelay,
  });

  wss.registerEvents('worker:queue', {
    [CLAIM]: async (ws, event: PhoenixEvent<ClaimPayload>) => {
      const { runs } = await pullClaim(state, ws, event);
      state.events.emit(CLAIM, {
        payload: runs,
        state: clone(state),
      });
    },
  });

  const startRun = (runId: string) => {
    logger?.info(`joining channel run:${runId}`);

    // mark the run as started on the server
    state.pending[runId] = {
      status: 'started',
      logs: [],
      steps: {},
    };

    const wrap = <T>(
      handler: (
        state: ServerState,
        ws: DevSocket,
        evt: PhoenixEvent<T>,
        runId: string
      ) => void
    ) => {
      return (ws: DevSocket, event: PhoenixEvent<T>) => {
        handler(state, ws, event, runId);
        // emit each event and the state after to the event handler, for debug
        state.events.emit(event.event, {
          runId,
          payload: event.payload,
          state: clone(state),
        });
      };
    };

    const { unsubscribe } = wss.registerEvents(`run:${runId}`, {
      [GET_PLAN]: wrap(getRun),
      [RUN_START]: wrap(handleStartRun),
      [GET_CREDENTIAL]: wrap(getCredential),
      [GET_DATACLIP]: wrap(getDataclip),
      [STEP_START]: wrap(handleStepStart),
      [RUN_LOG]: wrap(handleLog),
      [STEP_COMPLETE]: wrap(handleStepComplete),
      [RUN_COMPLETE]: wrap((...args) => {
        handleRunComplete(...args);
        unsubscribe();
      }),
    });
  };

  return {
    startRun,
    messageClients: wss.sendToClients.bind(this),
    close: () => {
      server.close();
      (wss as any).close();
    },
  };

  // pull claim will try and pull a claim off the queue,
  // and reply with the response
  // the reply ensures that only the calling worker will get the run
  async function pullClaim(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<ClaimPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const { queue, options } = state;
    let count = 1;

    const runs: ClaimRun[] = [];
    const payload = {
      status: 'ok' as const,
      response: { runs } as ClaimReply,
    };

    while (count > 0 && queue.length) {
      // TODO assign the worker id to the run
      // Not needed by the mocks at the moment
      const next = queue.shift();

      const token = await generateRunToken(next!, options.runPrivateKey);

      runs.push({ id: next!, token });
      count -= 1;

      startRun(next!);
    }
    if (runs.length) {
      logger?.info(`Claiming ${runs.length} runs`);
    } else {
      logger?.debug('No claims (queue empty)');
    }

    ws.reply<ClaimReply>({ ref, join_ref, topic, payload });
    return payload.response;
  }

  function getRun(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GetPlanPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const runId = extractRunId(topic);
    const response = state.runs[runId];

    ws.reply<GetPlanReply>({
      ref,
      join_ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  function handleStartRun(
    _state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<RunStartPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const [_, runId] = topic.split(':');
    let payload = {
      status: 'ok' as PhoenixEventStatus,
    };
    if (!state.pending[runId] || state.pending[runId].status !== 'started') {
      payload = {
        status: 'error',
      };
    }
    ws.reply<RunStartReply>({
      ref,
      join_ref,
      topic,
      payload,
    });
  }

  function getCredential(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GetCredentialPayload>
  ) {
    const { ref, join_ref, topic, payload } = evt;

    let response;
    const cred = state.credentials[payload.id];

    if (payload.id === '%TIMEOUT%') {
      // Simulate a timeout with this special id
      return;
    } else if (cred) {
      response = {
        status: 'ok',
        response: cred,
      };
    } else {
      response = {
        status: 'error',
        response: { errors: { id: ['Credential not found!'] } },
      };
    }

    ws.reply<GetCredentialReply>({
      ref,
      join_ref,
      topic,
      // @ts-ignore
      payload: response,
    });
  }

  function getDataclip(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GetDataclipPayload>
  ) {
    const { ref, topic, join_ref } = evt;
    const dataclip = state.dataclips[evt.payload.id];

    let payload;
    if (dataclip) {
      payload = {
        status: 'ok',
        response: enc.encode(stringify(dataclip)),
      };
    } else {
      // TODO I think this actually tidier than what lightning does...
      payload = {
        status: 'error',
        response: 'not_found',
      };
    }

    ws.reply<GetDataClipReply>({
      ref,
      join_ref,
      topic,
      // @ts-ignore
      payload,
    });
  }

  function handleLog(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<RunLogPayload>
  ) {
    const { ref, join_ref, topic } = evt;

    let payload: any = {
      status: 'ok',
    };

    const { run_id: runId } = evt.payload;

    if (evt.payload.logs) {
      // handle batch logs
      evt.payload.logs.forEach((log) => {
        state.pending[runId].logs.push(log);

        logger?.info(`LOG [${runId}] ${log.message}`);

        if (!log.message || !log.source || !log.timestamp || !log.level) {
          payload = {
            status: 'error',
            response: 'Missing property on log',
          };
        }
      });
    } else {
      // handle legacy logs
      const log = evt.payload as unknown as LegacyRunLogPayload;
      state.pending[runId].logs.push(log);

      logger?.info(`LOG [${runId}] ${log.message}`);

      if (!log.message || !log.source || !log.timestamp || !log.level) {
        payload = {
          status: 'error',
          response: 'Missing property on log',
        };
      }
    }

    ws.reply<RunLogReply>({
      ref,
      join_ref,
      topic,
      payload,
    });
  }

  function handleRunComplete(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<RunCompletePayload>,
    runId: string
  ) {
    const { ref, join_ref, topic } = evt;
    const {
      final_state,
      reason,
      error_type,
      error_message,
      timestamp, // whitelist timestamp
      ...rest
    } = evt.payload;

    logger?.info('Completed run ', runId);
    logger?.debug(final_state);

    state.pending[runId].status = 'complete';

    // Store the final state directly from the payload
    if (!state.results[runId]) {
      state.results[runId] = { state: null, workerId: 'mock' };
    }
    if (final_state) {
      state.results[runId].state = final_state;
    }

    let payload: any = validateReasons(evt.payload);

    const invalidKeys = Object.keys(rest);
    if (payload.status === 'ok' && invalidKeys.length) {
      payload = {
        status: 'error',
        response: `Unexpected keys: ${invalidKeys.join(',')}`,
      };
    }

    ws.reply<RunCompleteReply>({
      ref,
      join_ref,
      topic,
      payload,
    });
  }

  function handleStepStart(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<StepStartPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const { step_id, job_id } = evt.payload;

    const [_, runId] = topic.split(':');
    if (!state.dataclips) {
      state.dataclips = {};
    }
    state.pending[runId].steps[job_id] = step_id;

    // let payload: any = {
    //   status: 'error',
    //   response: 'test_error',
    // };

    let payload: any = {
      status: 'ok',
    };

    if (!step_id) {
      payload = {
        status: 'error',
        response: 'no step_id',
      };
    } else if (!job_id) {
      payload = {
        status: 'error',
        response: 'no job_id',
      };
    }

    ws.reply<StepStartReply>({
      ref,
      join_ref,
      topic,
      payload,
    });
  }

  function handleStepComplete(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<StepCompletePayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const { output_dataclip_id, output_dataclip } = evt.payload;

    let payload: any = validateReasons(evt.payload);

    if (!output_dataclip) {
      payload = {
        status: 'error',
        response: 'no output_dataclip',
      };
    } else if (!output_dataclip_id) {
      payload = {
        status: 'error',
        response: 'no output_dataclip_id',
      };
    } else {
      if (!state.dataclips) {
        state.dataclips = {};
      }
      state.dataclips[output_dataclip_id] = JSON.parse(output_dataclip!);
    }

    // be polite and acknowledge the event
    ws.reply<StepCompleteReply>({
      ref,
      join_ref,
      topic,
      payload,
    });
  }
};

export default createSocketAPI;
