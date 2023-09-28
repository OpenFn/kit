import { WebSocketServer } from 'ws';
import createLogger, { Logger } from '@openfn/logger';

import type { ServerState } from './server';

import { extractAttemptId } from './util';

import createPheonixMockSocketServer, {
  DevSocket,
  PhoenixEvent,
} from './socket-server';
import {
  ATTEMPT_COMPLETE,
  ATTEMPT_COMPLETE_PAYLOAD,
  ATTEMPT_COMPLETE_REPLY,
  ATTEMPT_LOG,
  ATTEMPT_LOG_PAYLOAD,
  ATTEMPT_LOG_REPLY,
  CLAIM,
  CLAIM_PAYLOAD,
  CLAIM_REPLY,
  GET_ATTEMPT,
  GET_ATTEMPT_PAYLOAD,
  GET_ATTEMPT_REPLY,
  GET_CREDENTIAL,
  GET_CREDENTIAL_PAYLOAD,
  GET_CREDENTIAL_REPLY,
  GET_DATACLIP,
  GET_DATACLIP_PAYLOAD,
  GET_DATACLIP_REPLY,
} from '../../events';

import type { Server } from 'http';
import { stringify } from '../../util';

const enc = new TextEncoder();

// this new API is websocket based
// Events map to handlers
// can I even implement this in JS? Not with pheonix anyway. hmm.
// dead at the first hurdle really.
// what if I do the server side mock in koa, can I use the pheonix client to connect?
const createSocketAPI = (
  state: ServerState,
  path: string,
  httpServer: Server,
  logger?: Logger
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
    logger: logger && createLogger('PHX', { level: 'debug' }),
  });

  wss.registerEvents('attempts:queue', {
    [CLAIM]: (ws, event: PhoenixEvent<CLAIM_PAYLOAD>) =>
      pullClaim(state, ws, event),
  });

  const startAttempt = (attemptId: string) => {
    // mark the attempt as started on the server
    state.pending[attemptId] = {
      status: 'started',
      logs: [],
    };

    // TODO do all these need extra auth, or is auth granted
    // implicitly by channel membership?
    // Right now the socket gets access to all server state
    // But this is just a mock - Lightning can impose more restrictions if it wishes
    const { unsubscribe } = wss.registerEvents(`attempt:${attemptId}`, {
      // TODO how will I validate the join in my mock?
      [GET_ATTEMPT]: (ws, event: PhoenixEvent<GET_ATTEMPT_PAYLOAD>) =>
        getAttempt(state, ws, event),
      [GET_CREDENTIAL]: (ws, event: PhoenixEvent<GET_CREDENTIAL_PAYLOAD>) =>
        getCredential(state, ws, event),
      [GET_DATACLIP]: (ws, event: PhoenixEvent<GET_DATACLIP_PAYLOAD>) =>
        getDataclip(state, ws, event),
      [ATTEMPT_LOG]: (ws, event: PhoenixEvent<ATTEMPT_LOG_PAYLOAD>) =>
        handleLog(state, ws, event),
      [ATTEMPT_COMPLETE]: (
        ws,
        event: PhoenixEvent<ATTEMPT_COMPLETE_PAYLOAD>
      ) => {
        handleAttemptComplete(state, ws, event, attemptId);
        unsubscribe();
      },
      // TODO
      // [RUN_START]
      // [RUN_COMPLETE]
    });
  };

  return {
    startAttempt,
  };

  // pull claim will try and pull a claim off the queue,
  // and reply with the response
  // the reply ensures that only the calling worker will get the attempt
  function pullClaim(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<CLAIM_PAYLOAD>
  ) {
    const { ref, topic } = evt;
    const { queue } = state;
    let count = 1;

    const payload = {
      status: 'ok' as const,
      response: [] as CLAIM_REPLY,
    };

    while (count > 0 && queue.length) {
      // TODO assign the worker id to the attempt
      // Not needed by the mocks at the moment
      const next = queue.shift();
      // TODO the token in the mock is trivial because we're not going to do any validation on it yet
      // TODO need to save the token associated with this attempt
      payload.response.push({ id: next!, token: 'x.y.z' });
      count -= 1;

      startAttempt(next!);
    }
    if (payload.response.length) {
      logger?.info(`Claiming ${payload.response.length} attempts`);
    } else {
      logger?.info('No claims (queue empty)');
    }

    ws.reply<CLAIM_REPLY>({ ref, topic, payload });
  }

  function getAttempt(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GET_ATTEMPT_PAYLOAD>
  ) {
    const { ref, topic } = evt;
    const attemptId = extractAttemptId(topic);
    const response = state.attempts[attemptId]; /// TODO this is badly typed

    ws.reply<GET_ATTEMPT_REPLY>({
      ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  function getCredential(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GET_CREDENTIAL_PAYLOAD>
  ) {
    const { ref, topic, payload } = evt;
    const response = state.credentials[payload.id];
    // console.log(topic, event, response);
    ws.reply<GET_CREDENTIAL_REPLY>({
      ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  function getDataclip(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<GET_DATACLIP_PAYLOAD>
  ) {
    const { ref, topic, payload } = evt;
    const dataclip = state.dataclips[payload.id];

    // Send the data as an ArrayBuffer (our stringify function will do this)
    const response = enc.encode(stringify(dataclip));

    ws.reply<GET_DATACLIP_REPLY>({
      ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  function handleLog(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<ATTEMPT_LOG_PAYLOAD>
  ) {
    const { ref, topic, payload } = evt;
    const { attempt_id: attemptId } = payload;

    state.pending[attemptId].logs.push(payload);

    ws.reply<ATTEMPT_LOG_REPLY>({
      ref,
      topic,
      payload: {
        status: 'ok',
      },
    });
  }

  function handleAttemptComplete(
    state: ServerState,
    ws: DevSocket,
    evt: PhoenixEvent<ATTEMPT_COMPLETE_PAYLOAD>,
    attemptId: string
  ) {
    const { ref, topic, payload } = evt;
    const { dataclip } = payload;

    logger?.info('Completed attempt ', attemptId);
    logger?.debug(dataclip);

    state.pending[attemptId].status = 'complete';
    state.results[attemptId] = dataclip;

    state.events.emit(ATTEMPT_COMPLETE, {
      attemptId: attemptId,
      dataclip,
      logs: state.pending[attemptId].logs,
    });

    ws.reply<ATTEMPT_COMPLETE_REPLY>({
      ref,
      topic,
      payload: {
        status: 'ok',
      },
    });
  }
};

export default createSocketAPI;