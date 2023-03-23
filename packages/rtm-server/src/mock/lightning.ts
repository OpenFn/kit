import { EventEmitter } from 'node:events';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from '@koa/router';

import * as data from './data';
import { LightningAttempt, State } from '../types';
import { RTMEvent } from './runtime-manager';

const unimplemented = (ctx) => {
  ctx.statusCode = 501;
};

type NotifyEvent = {
  event: RTMEvent;
  workflow: string; // workflow id
  [key: string]: any;
};

export const API_PREFIX = `/api/v1`;

// a mock lightning server
const createLightningServer = (options = {}) => {
  // App state
  const credentials = data.credentials();
  const attempts = data.attempts();
  const queue: string[] = [];
  const results = {};

  // Server setup
  const app = new Koa();
  const router = new Router();
  const events = new EventEmitter();
  app.use(bodyParser());

  // Mock API endpoints

  // POST attempts/next:
  //  200 - return an array of pending attempts
  //  204 - queue empty (no body)
  router.post(`${API_PREFIX}/attempts/next`, (ctx) => {
    const { body } = ctx.request;
    if (!body || !body.id) {
      ctx.status = 400;
      return;
    }

    let count = ctx.request.query.count || 1;
    const payload = [];

    while (count > 0 && queue.length) {
      // TODO assign the worker id to the attempt
      // Not needed by the mocks at the moment
      payload.push(queue.shift());
      count -= 1;
    }

    if (payload.length > 0) {
      ctx.body = JSON.stringify(payload);
      ctx.status = 200;
    } else {
      ctx.body = undefined;
      ctx.status = 204;
    }
  });

  // GET credential/:id
  // 200 - return a credential object
  // 404 - credential not found
  router.get(`${API_PREFIX}/credential/:id`, (ctx) => {
    const cred = credentials[ctx.params.id];
    if (cred) {
      ctx.body = JSON.stringify(cred);
      ctx.status = 200;
    } else {
      ctx.status = 404;
    }
  });

  // Notify of some job update
  // proxy to event emitter
  // { event: 'event-name', ...data }
  router.post(`${API_PREFIX}/attempts/notify/:id`, (ctx) => {
    const { event: name, ...payload } = ctx.request.body;

    const event = {
      id: ctx.params.id,
      name,
      ...payload, // spread payload?
    };

    events.emit('notify', event);

    ctx.status = 200;
  });

  // Notify an attempt has finished
  // Could be error or success state
  // Error or state in payload
  // { data } | { error }
  router.post(`${API_PREFIX}/attempts/complete/:id`, (ctx) => {
    const finalState = ctx.data as State;

    results[ctx.params.id] = finalState;

    ctx.status = 200;
  });

  // Unimplemented API endpoints

  router.get(`${API_PREFIX}/attempts/:id`, unimplemented);
  router.get(`${API_PREFIX}/attempts/next`, unimplemented); // ?count=1
  router.get(`${API_PREFIX}/attempts/done`, unimplemented); // ?project=pid

  router.get(`${API_PREFIX}/credential/:id`, unimplemented);
  router.get(`${API_PREFIX}/attempts/active`, unimplemented);

  router.get(`${API_PREFIX}/workflows`, unimplemented);
  router.get(`${API_PREFIX}/workflows/:id`, unimplemented);

  app.use(router.routes());

  // Dev APIs for unit testing
  app.addCredential = (id: string, cred: Credential) => {
    credentials[id] = cred;
  };
  app.addAttempt = (attempt: LightningAttempt) => {
    attempts[attempt.id] = attempt;
  };
  app.addToQueue = (attemptId: string) => {
    if (attempts[attemptId]) {
      queue.push(attempts[attemptId]);
      return true;
    }
    return false;
  };
  app.getQueueLength = () => queue.length;
  app.on = (event: 'notify', fn: (evt: any) => void) => {
    events.addListener(event, fn);
  };
  app.once = (event: 'notify', fn: (evt: any) => void) => {
    events.once(event, fn);
  };

  const server = app.listen(options.port || 8888);

  app.destroy = () => {
    server.close();
  };

  return app;
};

export default createLightningServer;
