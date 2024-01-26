import { WebSocketServer } from 'ws';
import createLogger, { LogLevel, Logger } from '@openfn/logger';
import type { Server } from 'http';

import createPheonixMockSocketServer, {
  DevSocket,
  PhoenixEvent,
  PhoenixEventStatus,
} from './socket-server';
import {
  ATTEMPT_COMPLETE,
  ATTEMPT_LOG,
  ATTEMPT_START,
  CLAIM,
  GET_ATTEMPT,
  GET_CREDENTIAL,
  GET_DATACLIP,
  STEP_COMPLETE,
  STEP_START,
} from './events';
import { extractAttemptId, stringify } from './util';

import type { ServerState } from './server';
import type {
  AttemptStartPayload,
  AttemptStartReply,
  AttemptCompletePayload,
  AttemptCompleteReply,
  AttemptLogPayload,
  AttemptLogReply,
  ClaimAttempt,
  ClaimPayload,
  ClaimReply,
  GetAttemptPayload,
  GetAttemptReply,
  GetCredentialPayload,
  GetCredentialReply,
  GetDataclipPayload,
  GetDataClipReply,
  StepCompletePayload,
  StepCompleteReply,
  StepStartPayload,
  StepStartReply,
} from './types';

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
  logLevel?: LogLevel
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
  });

  wss.registerEvents('worker:queue', {
    [CLAIM]: (ws, event: PhoenixEvent<ClaimPayload>) => {
      const { attempts } = pullClaim(state, ws, event);
      state.events.emit(CLAIM, {
        payload: attempts,
        state: clone(state),
      });
    },
  });

  const startAttempt = (attemptId: string) => {
    logger?.info(`joining channel attempt:${attemptId}`);

    // mark the attempt as started on the server
    state.pending[attemptId] = {
      status: 'started',
      logs: [],
      steps: {},
    };

    const wrap = <T>(
      handler: (
        state: ServerState,
        ws: DevSocket,
        evt: PhoenixEvent<T>,
        attemptId: string
      ) => void
    ) => {
      return (ws: DevSocket, event: PhoenixEvent<T>) => {
        handler(state, ws, event, attemptId);
        // emit each event and the state after to the event handler, for debug
        state.events.emit(event.event, {
          attemptId,
          payload: event.payload,
          state: clone(state),
        });
      };
    };

    const { unsubscribe } = wss.registerEvents(`attempt:${attemptId}`, {
      [GET_ATTEMPT]: wrap(getAttempt),
      [ATTEMPT_START]: wrap(handleStartAttempt),
      [GET_CREDENTIAL]: wrap(getCredential),
      [GET_DATACLIP]: wrap(getDataclip),
      [STEP_START]: wrap(handleStepStart),
      [ATTEMPT_LOG]: wrap(handleLog),
      [STEP_COMPLETE]: wrap(handleStepComplete),
      [ATTEMPT_COMPLETE]: wrap((...args) => {
        handleAttemptComplete(...args);
        unsubscribe();
      }),
    });
  };

  return {
    startAttempt,
    close: () => {
      server.close();
      (wss as any).close();
    },
  };

  // pull claim will try and pull a claim off the queue,
  // and reply with the response
  // the reply ensures that only the calling worker will get the attempt
  function pullClaim(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<ClaimPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const { queue } = state;
    let count = 1;

    const attempts: ClaimAttempt[] = [];
    const payload = {
      status: 'ok' as const,
      response: { attempts } as ClaimReply,
    };

    while (count > 0 && queue.length) {
      // TODO assign the worker id to the attempt
      // Not needed by the mocks at the moment
      const next = queue.shift();
      // TODO the token in the mock is trivial because we're not going to do any validation on it yet
      // TODO need to save the token associated with this attempt
      attempts.push({ id: next!, token: 'x.y.z' });
      count -= 1;

      startAttempt(next!);
    }
    if (attempts.length) {
      logger?.info(`Claiming ${attempts.length} attempts`);
    } else {
      logger?.debug('No claims (queue empty)');
    }

    ws.reply<ClaimReply>({ ref, join_ref, topic, payload });
    return payload.response;
  }

  function getAttempt(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GetAttemptPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const attemptId = extractAttemptId(topic);
    const response = state.attempts[attemptId];

    ws.reply<GetAttemptReply>({
      ref,
      join_ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  function handleStartAttempt(
    _state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<AttemptStartPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const [_, attemptId] = topic.split(':');
    let payload = {
      status: 'ok' as PhoenixEventStatus,
    };
    if (
      !state.pending[attemptId] ||
      state.pending[attemptId].status !== 'started'
    ) {
      payload = {
        status: 'error',
      };
    }
    ws.reply<AttemptStartReply>({
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
    const response = state.credentials[payload.id];
    // console.log(topic, event, response);
    ws.reply<GetCredentialReply>({
      ref,
      join_ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  // TODO this mock function is broken in the phoenix package update
  // (I am not TOO worried, the actual integration works fine)
  function getDataclip(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GetDataclipPayload>
  ) {
    const { ref, topic, join_ref } = evt;
    const dataclip = state.dataclips[evt.payload.id];

    // Send the data as an ArrayBuffer (our stringify function will do this)
    const payload = {
      status: 'ok',
      response: enc.encode(stringify(dataclip)),
    };

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
    evt: PhoenixEvent<AttemptLogPayload>
  ) {
    const { ref, join_ref, topic } = evt;
    const { attempt_id: attemptId } = evt.payload;

    state.pending[attemptId].logs.push(evt.payload);

    let payload: any = {
      status: 'ok',
    };

    if (
      !evt.payload.message ||
      !evt.payload.source ||
      !evt.payload.timestamp ||
      !evt.payload.level
    ) {
      payload = {
        status: 'error',
        response: 'Missing property on log',
      };
    }

    logger?.info(`LOG [${attemptId}] ${evt.payload.message[0]}`);

    ws.reply<AttemptLogReply>({
      ref,
      join_ref,
      topic,
      payload,
    });
  }

  function handleAttemptComplete(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<AttemptCompletePayload>,
    attemptId: string
  ) {
    const { ref, join_ref, topic } = evt;
    const { final_dataclip_id, reason, error_type, error_message, ...rest } =
      evt.payload;

    logger?.info('Completed attempt ', attemptId);
    logger?.debug(final_dataclip_id);

    state.pending[attemptId].status = 'complete';

    // TODO we'll remove this stuff soon
    if (!state.results[attemptId]) {
      state.results[attemptId] = { state: null, workerId: 'mock' };
    }
    if (final_dataclip_id) {
      state.results[attemptId].state = state.dataclips[final_dataclip_id];
    }

    let payload: any = validateReasons(evt.payload);

    const invalidKeys = Object.keys(rest);
    if (payload.status === 'ok' && invalidKeys.length) {
      payload = {
        status: 'error',
        response: `Unexpected keys: ${invalidKeys.join(',')}`,
      };
    }

    ws.reply<AttemptCompleteReply>({
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
    const { step_id, job_id, input_dataclip_id } = evt.payload;

    const [_, attemptId] = topic.split(':');
    if (!state.dataclips) {
      state.dataclips = {};
    }
    state.pending[attemptId].steps[job_id] = step_id;

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
    } else if (!input_dataclip_id) {
      payload = {
        status: 'error',
        response: 'no input_dataclip_id',
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
