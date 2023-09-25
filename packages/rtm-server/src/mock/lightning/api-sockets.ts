import { WebSocketServer } from 'ws';
import createLogger, { Logger } from '@openfn/logger';

import type { ServerState } from './server';

import { extractAttemptId } from './util';

import createPheonixMockSocketServer from './socket-server';
import {
  ATTEMPT_COMPLETE,
  CLAIM,
  GET_ATTEMPT,
  GET_CREDENTIAL,
  GET_DATACLIP,
} from '../../events';

// this new API is websocket based
// Events map to handlers
// can I even implement this in JS? Not with pheonix anyway. hmm.
// dead at the first hurdle really.
// what if I do the server side mock in koa, can I use the pheonix client to connect?
const createSocketAPI = (
  state: ServerState,
  path: string,
  httpServer,
  logger?: Logger
) => {
  // set up a websocket server to listen to connections
  // console.log('path', path);
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

  // TODO
  // 1) Need to improve the abstraction of these, make messages easier to send
  // 2) Also need to look at closures - I'd like a declarative central API
  //    the need to call startAttempt makes things a bit harder

  // pull claim will try and pull a claim off the queue,
  // and reply with the response
  // the reply ensures that only the calling worker will get the attempt
  const pullClaim = (state, ws, evt) => {
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
  };

  const getAttempt = (state, ws, evt) => {
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
  };

  const getCredential = (state, ws, evt) => {
    const { ref, topic, payload, event } = evt;
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
  };

  const getDataclip = (state, ws, evt) => {
    const { ref, topic, payload, event } = evt;
    const response = state.dataclips[payload.id];
    console.log(response);
    ws.reply({
      ref,
      topic,
      payload: {
        status: 'ok',
        response,
      },
    });
  };

  // TODO why is this firing a million times?
  const handleAttemptComplete = (state, ws, evt) => {
    const { id, ref, topic, dataclip } = evt;

    // TODO use proper logger
    console.log('Completed attempted ', id);
    console.log(dataclip);

    // TODO what does the mock do here?
    // well, we should acknowlege
    // Should we error if there's no dataclip?
    // but who does that help?
    ws.reply({
      ref,
      topic,
      payload: {
        status: 'ok',
        // response: {
        //   dataclip,
        // },
      },
    });
  };

  wss.registerEvents('attempts:queue', {
    [CLAIM]: (ws, event) => pullClaim(state, ws, event),
  });

  const startAttempt = (attemptId) => {
    // mark the attempt as started on the server
    state.pending[attemptId] = {
      status: 'started',
    };

    // TODO do all these need extra auth, or is auth granted
    // implicitly by channel membership?
    // Right now the socket gets access to all server state
    // But this is just a mock - Lightning can impose more restrictions if it wishes
    wss.registerEvents(`attempt:${attemptId}`, {
      [GET_ATTEMPT]: (ws, event) => getAttempt(state, ws, event),
      [GET_CREDENTIAL]: (ws, event) => getCredential(state, ws, event),
      [GET_DATACLIP]: (ws, event) => getDataclip(state, ws, event),
      [ATTEMPT_COMPLETE]: (ws, event) =>
        handleAttemptComplete(state, ws, { id: attemptId, ...event }),
    });
  };

  return {
    startAttempt,
  };
};

export default createSocketAPI;
