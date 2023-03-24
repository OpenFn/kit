import type Router from '@koa/router';
import {
  unimplemented,
  createFetchNextJob,
  createGetCredential,
  createNotify,
  createComplete,
} from './middleware';
import type { ServerState } from './server';

export const API_PREFIX = `/api/v1`;

export default (router: Router, state: ServerState) => {
  // POST attempts/next:
  //  200 - return an array of pending attempts
  //  204 - queue empty (no body)
  router.post(`${API_PREFIX}/attempts/next`, createFetchNextJob(state));

  // GET credential/:id
  // 200 - return a credential object
  // 404 - credential not found
  router.get(`${API_PREFIX}/credential/:id`, createGetCredential(state));

  // Notify of some job update
  // proxy to event emitter
  // { event: 'event-name', ...data }
  router.post(`${API_PREFIX}/attempts/notify/:id`, createNotify(state));

  // Notify an attempt has finished
  // Could be error or success state
  // Error or state in payload
  // { data } | { error }
  router.post(`${API_PREFIX}/attempts/complete/:id`, createComplete(state));

  router.get(`${API_PREFIX}/attempts/:id`, unimplemented);
  router.get(`${API_PREFIX}/attempts/next`, unimplemented); // ?count=1
  router.get(`${API_PREFIX}/attempts/done`, unimplemented); // ?project=pid
  router.get(`${API_PREFIX}/attempts/active`, unimplemented);

  router.get(`${API_PREFIX}/credential/:id`, unimplemented);

  router.get(`${API_PREFIX}/workflows`, unimplemented);
  router.get(`${API_PREFIX}/workflows/:id`, unimplemented);

  return router;
};
