import type Router from '@koa/router';
import {
  unimplemented,
  createFetchNextJob,
  createGetCredential,
  createLog,
  createComplete,
} from './middleware';
import type { ServerState } from './server';

export const API_PREFIX = `/api/1`;

interface RTMBody {
  rtm_id: string;
}

export interface FetchNextBody extends RTMBody {}

export interface AttemptCompleteBody extends RTMBody {
  state: any; // JSON state object (undefined? null?)
}

export default (router: Router, state: ServerState) => {
  // Basically all requests must include an rtm_id
  // And probably later a security token

  // POST attempts/next
  // Removes Attempts from the queue and returns them to the caller
  // Lightning should track who has each attempt
  //  200 - return an array of pending attempts
  //  204 - queue empty (no body)
  router.post(`${API_PREFIX}/attempts/next`, createFetchNextJob(state));

  // GET credential/:id
  // Get a credential
  // 200 - return a credential object
  // 404 - credential not found
  router.get(`${API_PREFIX}/credential/:id`, createGetCredential(state));

  // Notify for a batch of job logs
  // [{ rtm_id, logs: ['hello world' ] }]
  // TODO this could use a websocket to handle the high volume of logs
  router.post(`${API_PREFIX}/attempts/log/:id`, createLog(state));

  // Notify an attempt has finished
  // Could be error or success state
  // If a complete comes in from an unexpected source (ie a timed out job), this should throw
  // state and rtm_id should be in the payload
  // { rtm,_id, state } | { rtmId, error }
  router.post(`${API_PREFIX}/attempts/complete/:id`, createComplete(state));

  // TODO i want this too: confirm that an attempt has started
  router.post(`${API_PREFIX}/attempts/start/:id`, () => {});

  // Listing APIs - these list details without changing anything
  router.get(`${API_PREFIX}/attempts/:id`, unimplemented);
  router.get(`${API_PREFIX}/attempts/next`, unimplemented); // ?count=1
  router.get(`${API_PREFIX}/attempts/done`, unimplemented); // ?project=pid
  router.get(`${API_PREFIX}/attempts/active`, unimplemented);

  router.get(`${API_PREFIX}/credential/:id`, unimplemented);

  router.get(`${API_PREFIX}/workflows`, unimplemented);
  router.get(`${API_PREFIX}/workflows/:id`, unimplemented);

  return router;
};
