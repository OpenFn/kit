import Router from '@koa/router';
import Socket, { WebSocketServer } from 'ws';
import {
  unimplemented,
  createListNextJob,
  createFetchNextJob,
  createGetCredential,
  createLog,
  createComplete,
} from './middleware';
import type { ServerState } from './server';

import { API_PREFIX } from './server';

import createPheonixMockSocketServer from '../socket-server';

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
export const createNewAPI = (state: ServerState, path: string, server) => {
  // set up a websocket server to listen to connections
  // console.log('path', path);
  const wss = new WebSocketServer({
    server,

    // Note: phoenix websocket will connect to <endpoint>/websocket
    path: path ? `${path}/websocket` : undefined,
  });

  // pass that through to the phoenix mock
  createPheonixMockSocketServer({ server: wss });

  // then do something clever to map events
  // server.on({
  //   'attempt:claim': noop,
  //   'attempt:start': noop,
  // })

  const noop = () => {};

  // This may actually get split into a server bit and a an attempts bit, reflecting the different channels
  const events = {
    hello: noop,

    'attempt:claim': noop,
    'attempt:start': noop,
    'attempt:complete': noop,
    'attempt:get_credential': noop,
    'attempt:credential': noop,
    'attempt:get_dataclip': noop,
    'attempt:dataclip': noop,

    'run:start': noop,
    'run:end': noop,
    'run:log': noop,
  };

  // const handleEvent = (name) => {};

  // return handleEvent;

  // return (ctx) => {
  //   // what does this actually do?
  //   console.log(' >> ', ctx);
  // };
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
