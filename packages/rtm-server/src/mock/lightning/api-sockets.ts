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
  ATTEMPT_LOG,
  CLAIM,
  GET_ATTEMPT,
  GET_CREDENTIAL,
  GET_DATACLIP,
} from '../../events';

import type { Server } from 'http';

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
    server,
    state,
    logger: logger && createLogger('PHX', { level: 'debug' }),
  });

  wss.registerEvents('attempts:queue', {
    [CLAIM]: (ws, event) => pullClaim(state, ws, event),
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
      [GET_ATTEMPT]: (ws, event) => getAttempt(state, ws, event),
      [GET_CREDENTIAL]: (ws, event) => getCredential(state, ws, event),
      [GET_DATACLIP]: (ws, event) => getDataclip(state, ws, event),
      [ATTEMPT_LOG]: (ws, event) => handleLog(state, ws, event),
      [ATTEMPT_COMPLETE]: (ws, event) => {
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
  function pullClaim(state: ServerState, ws: DevSocket, evt) {
    const { ref, topic } = evt;
    const { queue } = state;
    let count = 1;

    const payload = {
      status: 'ok',
      response: [],
    };

    while (count > 0 && queue.length) {
      // TODO assign the worker id to the attempt
      // Not needed by the mocks at the moment
      const next = queue.shift();
      payload.response.push(next);
      count -= 1;

      startAttempt(next);
    }
    if (payload.response.length) {
      logger?.info(`Claiming ${payload.response.length} attempts`);
    } else {
      logger?.info('No claims (queue empty)');
    }

    ws.reply({ ref, topic, payload });
  }

  function getAttempt(state: ServerState, ws: DevSocket, evt) {
    const { ref, topic } = evt;
    const attemptId = extractAttemptId(topic);
    const attempt = state.attempts[attemptId];

    ws.reply({
      ref,
      topic,
      payload: {
        status: 'ok',
        response: attempt,
      },
    });
  }

  function getCredential(state: ServerState, ws: DevSocket, evt) {
    const { ref, topic, payload } = evt;
    const response = state.credentials[payload.id];
    // console.log(topic, event, response);
    ws.reply({
      ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  function getDataclip(state: ServerState, ws: DevSocket, evt) {
    const { ref, topic, payload } = evt;
    const response = state.dataclips[payload.id];

    ws.reply({
      ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  }

  function handleLog(state: ServerState, ws: DevSocket, evt) {
    const { ref, topic, payload } = evt;
    const { attempt_id: attemptId } = payload;

    state.pending[attemptId].logs.push(payload);

    ws.reply({
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
    evt: PhoenixEvent,
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

    ws.reply({
      ref,
      topic,
      payload: {
        status: 'ok',
      },
    });
  }
};

export default createSocketAPI;
