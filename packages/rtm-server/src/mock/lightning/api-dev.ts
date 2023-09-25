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

const setupDevAPI = (app: DevApp, state: ServerState, logger: Logger, api) => {
  // Dev APIs for unit testing
  app.addCredential = (id: string, cred: Credential) => {
    logger.info(`Add credential ${id}`);
    state.credentials[id] = cred;
  };

  app.getCredential = (id: string) => state.credentials[id];

  app.addDataclip = (id: string, data: any) => {
    logger.info(`Add dataclip ${id}`);
    state.dataclips[id] = data;
  };

  app.getDataclip = (id: string) => state.dataclips[id];

  app.enqueueAttempt = (attempt: Attempt) => {
    state.attempts[attempt.id] = attempt;
    state.results[attempt.id] = {};
    state.pending[attempt.id] = {
      status: 'queued',
    };
    state.queue.push(attempt.id);
  };

  app.getAttempt = (id: string) => state.attempts[id];

  app.getState = () => state;

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

  app.reset = () => {
    state.queue = [];
    state.results = {};
  };

  app.getQueueLength = () => state.queue.length;

  app.getResult = (attemptId: string) => state.results[attemptId]?.state;

  app.startAttempt = (attemptId: string) => api.startAttempt(attemptId);

  // TODO probably remove?
  app.registerAttempt = (attempt: any) => {
    state.attempts[attempt.id] = attempt;
  };

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
const setupRestAPI = (app: DevApp, state: ServerState, logger: Logger) => {
  const router = new Router();

  router.post('/attempt', (ctx) => {
    const attempt = ctx.request.body;

    logger.info('Adding new attempt to queue:', attempt.id);
    logger.debug(attempt);

    if (!attempt.id) {
      attempt.id = crypto.randomUUID();
      logger.info('Generating new id for incoming attempt:', attempt.id);
    }

    // convert credentials and dataclips
    attempt.jobs.forEach((job) => {
      if (job.credential) {
        const cid = crypto.randomUUID();
        state.credentials[cid] = job.credential;
        job.credential = cid;
      }
    });

    app.enqueueAttempt(attempt);

    ctx.response.status = 200;
  });

  return router.routes();
};

export default (app: DevApp, state: ServerState, logger: Logger, api) => {
  setupDevAPI(app, state, logger, api);
  return setupRestAPI(app, state, logger);
};
