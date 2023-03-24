import { EventEmitter } from 'node:events';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from '@koa/router';

import createAPI from './api';
import * as data from '../data';
import { LightningAttempt } from '../../types';
import { RTMEvent } from '../runtime-manager';

type NotifyEvent = {
  event: RTMEvent;
  workflow: string; // workflow id
  [key: string]: any;
};

export type ServerState = {
  credentials: Record<string, any>;
  attempts: Record<string, any>;
  queue: LightningAttempt[];
  results: Record<string, any>;
  events: EventEmitter;
};

// a mock lightning server
const createLightningServer = (options = {}) => {
  // App state
  const state = {
    credentials: data.credentials(),
    attempts: data.attempts(),
    queue: [] as LightningAttempt[],
    results: {},
    events: new EventEmitter(),
  } as ServerState;

  // Server setup
  const app = new Koa();
  const api = createAPI(new Router(), state);
  app.use(bodyParser());

  // Mock API endpoints
  app.use(api.routes());

  // Dev APIs for unit testing
  app.addCredential = (id: string, cred: Credential) => {
    state.credentials[id] = cred;
  };
  app.addAttempt = (attempt: LightningAttempt) => {
    state.attempts[attempt.id] = attempt;
  };
  app.addToQueue = (attempt: string | LightningAttempt) => {
    if (typeof attempt == 'string') {
      if (state.attempts[attempt]) {
        state.queue.push(state.attempts[attempt]);
        return true;
      }
      throw new Error(`attempt ${attempt} not found`);
    } else if (attempt) {
      state.queue.push(attempt);
      return true;
    }
  };
  app.getQueueLength = () => state.queue.length;
  app.getResult = (attemptId: string) => state.results[attemptId];
  app.on = (event: 'notify', fn: (evt: any) => void) => {
    state.events.addListener(event, fn);
  };
  app.once = (event: 'notify', fn: (evt: any) => void) => {
    state.events.once(event, fn);
  };

  const server = app.listen(options.port || 8888);

  app.destroy = () => {
    server.close();
  };

  return app;
};

export default createLightningServer;
