/*
 * This module sets up a bunch of dev-only APIs
 * These are not intended to be reflected in Lightning itself
 */
import Koa from 'koa';
import Router from '@koa/router';
import { Logger } from '@openfn/logger';
import crypto from 'node:crypto';

import { Attempt } from '../../types';
import { ServerState } from './server';

type LightningEvents = 'log' | 'attempt-complete';

export type DevApp = Koa & {
  addCredential(id: string, cred: Credential): void;
  waitForResult(attemptId: string): Promise<any>;
  enqueueAttempt(attempt: Attempt, rtmId: string): void;
  reset(): void;
  getQueueLength(): number;
  getResult(attemptId: string): any;
  on(event: LightningEvents, fn: (evt: any) => void): void;
  once(event: LightningEvents, fn: (evt: any) => void): void;
};

const setupDevAPI = (app: DevApp, state: ServerState, logger: Logger) => {
  // Dev APIs for unit testing
  app.addCredential = (id: string, cred: Credential) => {
    logger.info(`Add credential ${id}`);
    state.credentials[id] = cred;
  };

  // Promise which returns when a workflow is complete
  app.waitForResult = (attemptId: string) => {
    return new Promise((resolve) => {
      const handler = (evt: any) => {
        if (evt.workflow_id === attemptId) {
          state.events.removeListener('attempt-complete', handler);
          resolve(evt);
        }
      };
      state.events.addListener('attempt-complete', handler);
    });
  };

  // Add an attempt to the queue
  // TODO actually it shouldn't take an rtm id until it's pulled off the attempt
  // Something feels off here
  app.enqueueAttempt = (attempt: Attempt, rtmId: string = 'rtm') => {
    logger.info(`Add Attempt ${attempt.id}`);

    state.results[attempt.id] = {
      rtmId,
      state: null,
    };
    state.queue.push(attempt);
  };

  app.reset = () => {
    state.queue = [];
    state.results = {};
  };

  app.getQueueLength = () => state.queue.length;

  app.getResult = (attemptId: string) => state.results[attemptId]?.state;

  // TODO these are overriding koa's event handler - should I be doing something different?

  // @ts-ignore
  app.on = (event: LightningEvents, fn: (evt: any) => void) => {
    state.events.addListener(event, fn);
  };

  // @ts-ignore
  app.once = (event: LightningEvents, fn: (evt: any) => void) => {
    state.events.once(event, fn);
  };
};

// Set up some rest endpoints
// Note that these are NOT prefixed
const setupRestAPI = (app: DevApp, _state: ServerState, logger: Logger) => {
  const router = new Router();

  router.post('/attempt', (ctx) => {
    const data = ctx.request.body;
    const rtmId = 'rtm'; // TODO include this in the body maybe?
    if (!data.id) {
      data.id = crypto.randomUUID();
      logger.info('Generating new id for incoming attempt:', data.id);
    }
    app.enqueueAttempt(data, rtmId);

    ctx.response.status = 200;
  });

  return router.routes();
};

export default (app: DevApp, state: ServerState, logger: Logger) => {
  setupDevAPI(app, state, logger);
  return setupRestAPI(app, state, logger);
};
