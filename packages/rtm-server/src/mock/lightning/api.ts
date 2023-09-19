import Router from '@koa/router';
import Socket, { WebSocketServer } from 'ws';
import {
  unimplemented,
  createListNextJob,
  createClaim,
  createGetCredential,
  createLog,
  createComplete,
} from './middleware';
import type { ServerState } from './server';

import { API_PREFIX } from './server';
import { extractAttemptId } from './util';

import createPheonixMockSocketServer from './socket-server';
import { CLAIM, GET_ATTEMPT } from '../../events';

interface RTMBody {
  rtm_id: string;
}

export interface FetchNextBody extends RTMBody {}

export interface AttemptCompleteBody extends RTMBody {
  state: any; // JSON state object (undefined? null?)
}

// this new API is websocket based
// Events map to handlers
// can I even implement this in JS? Not with pheonix anyway. hmm.
// dead at the first hurdle really.
// what if I do the server side mock in koa, can I use the pheonix client to connect?
export const createNewAPI = (state: ServerState, path: string, httpServer) => {
  // set up a websocket server to listen to connections
  // console.log('path', path);
  const server = new WebSocketServer({
    server: httpServer,

    // Note: phoenix websocket will connect to <endpoint>/websocket
    path: path ? `${path}/websocket` : undefined,
  });

  // pass that through to the phoenix mock
  const wss = createPheonixMockSocketServer({ server, state });

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
      payload.response.push(next.id);
      count -= 1;

      startAttempt(next.id);
    }

    ws.send(
      JSON.stringify({
        event: `chan_reply_${ref}`,
        ref,
        topic,
        payload,
      })
    );
  };

  const getAttempt = (state, ws, evt) => {
    const { ref, topic } = evt;
    const attemptId = extractAttemptId(topic);
    const attempt = state.attempts[attemptId];

    ws.send(
      JSON.stringify({
        event: `chan_reply_${ref}`,
        ref,
        topic,
        payload: {
          status: 'ok',
          response: attempt,
        },
      })
    );
  };

  wss.registerEvents('workers', {
    [CLAIM]: (ws, event) => pullClaim(state, ws, event),

    // is this part of the general workers pool, or part of the attempt?
    // probably part of the attempt because we can control permissions
  });

  const startAttempt = (attemptId) => {
    // mark the attempt as started on the server
    // TODO right now this duplicates logic in the dev API
    state.pending[attemptId] = {
      status: 'started',
    };

    wss.registerEvents(`attempt:${attemptId}`, {
      [GET_ATTEMPT]: (ws, event) => getAttempt(state, ws, event),
    });
  };

  return {
    startAttempt,
  };
};

// Note that this API is hosted at api/1
// Deprecated
export default (state: ServerState) => {
  const router = new Router({ prefix: API_PREFIX });
  // Basically all requests must include an rtm_id (And probably later a security token)
  // TODO actually, is this an RTM Id or an RTM Server id?

  // POST attempts/next
  // Removes Attempts from the queue and returns them to the caller
  // Lightning should track who has each attempt
  //  200 - return an array of pending attempts
  //  204 - queue empty (no body)
  router.post('/attempts/next', createFetchNextJob(state));

  // GET credential/:id
  // Get a credential
  // 200 - return a credential object
  // 404 - credential not found
  router.get('/credential/:id', createGetCredential(state));

  // Notify for a batch of job logs
  // [{ rtm_id, logs: ['hello world' ] }]
  // TODO this could use a websocket to handle the high volume of logs
  router.post('/attempts/log/:id', createLog(state));

  // Notify an attempt has finished
  // Could be error or success state
  // If a complete comes in from an unexpected source (ie a timed out job), this should throw
  // state and rtm_id should be in the payload
  // { rtm,_id, state } | { rtmId, error }
  router.post('/attempts/complete/:id', createComplete(state));

  // TODO i want this too: confirm that an attempt has started
  router.post('/attempts/start/:id', () => {});

  // Listing APIs - these list details without changing anything
  router.get('/attempts/next', createListNextJob(state)); // ?count=1
  router.get('/attempts/:id', unimplemented);
  router.get('/attempts/done', unimplemented); // ?project=pid
  router.get('/attempts/active', unimplemented);

  router.get('/credential/:id', unimplemented);

  router.get('/workflows', unimplemented);
  router.get('/workflows/:id', unimplemented);

  return router.routes();
};
