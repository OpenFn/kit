import Router from '@koa/router';
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

interface RTMBody {
  rtm_id: string;
}

export interface FetchNextBody extends RTMBody {}

export interface AttemptCompleteBody extends RTMBody {
  state: any; // JSON state object (undefined? null?)
}

// Note that this API is hosted at api/1
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
