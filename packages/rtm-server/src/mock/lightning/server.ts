import { EventEmitter } from 'node:events';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import koaLogger from 'koa-logger';
import Router from '@koa/router';

import createAPI from './api';
import { Attempt } from '../../types';
import { RTMEvent } from '../runtime-manager';

type NotifyEvent = {
  event: RTMEvent;
  workflow: string; // workflow id
  [key: string]: any;
};

export type ServerState = {
  credentials: Record<string, any>;
  attempts: Record<string, any>;
  queue: Attempt[];
  results: Record<string, { rtmId: string; state: null | any }>;
  events: EventEmitter;
};

// a mock lightning server
const createLightningServer = (options = {}) => {
  // App state
  const state = {
    credentials: {},
    attempts: [],

    // TODO for now, the queue will hold the actual Attempt data directly
    // I think later we want it to just hold an id?
    queue: [] as Attempt[],
    results: {},
    events: new EventEmitter(),
  } as ServerState;

  // Server setup
  const app = new Koa();
  app.use(bodyParser());

  const logger = koaLogger();

  // Mock API endpoints
  const api = createAPI(new Router({ prefix: '/api/1' }), logger, state);
  app.use(api.routes());

  app.use(logger);

  // Dev APIs for unit testing
  app.addCredential = (id: string, cred: Credential) => {
    state.credentials[id] = cred;
  };
  app.addAttempt = (attempt: Attempt) => {
    state.attempts[attempt.id] = attempt;
  };
  app.addToQueue = (attempt: string | Attempt, rtmId: string = 'rtm') => {
    if (typeof attempt == 'string') {
      app.addPendingWorkflow(attempt, rtmId);
      if (state.attempts[attempt]) {
        state.queue.push(state.attempts[attempt]);
        return true;
      }
      throw new Error(`attempt ${attempt} not found`);
    } else if (attempt) {
      app.addPendingWorkflow(attempt.id, rtmId);
      state.queue.push(attempt);
      return true;
    }
  };
  app.waitForResult = (workflowId: string) => {
    return new Promise((resolve) => {
      const handler = (evt) => {
        if (evt.workflow_id === workflowId) {
          state.events.removeListener('workflow-complete', handler);
          resolve(evt);
        }
      };
      state.events.addListener('workflow-complete', handler);
    });
  };
  app.addPendingWorkflow = (workflowId: string, rtmId: string) => {
    state.results[workflowId] = {
      rtmId,
      state: null,
    };
  };
  app.reset = () => {
    state.queue = [];
    state.results = {};
  };
  app.getQueueLength = () => state.queue.length;
  app.getResult = (attemptId: string) => state.results[attemptId]?.state;
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
