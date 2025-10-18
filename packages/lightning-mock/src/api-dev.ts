/*
 * This module sets up a bunch of dev-only APIs
 * These are not intended to be reflected in Lightning itself
 */
import Koa from 'koa';
import crypto from 'node:crypto';
import Router from '@koa/router';
import { Logger } from '@openfn/logger';
import type {
  LightningPlan,
  RunCompletePayload,
} from '@openfn/lexicon/lightning';

import { ServerState } from './server';
import { RUN_COMPLETE } from './events';
import type { DevServer, LightningEvents } from './types';
import { PhoenixEvent } from './socket-server';

type Api = {
  startRun(runId: string): void;
  messageClients(message: PhoenixEvent): void;
};

const setupDevAPI = (
  app: DevServer,
  state: ServerState,
  logger: Logger,
  api: Api
) => {
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

  app.messageSocketClients = (message: PhoenixEvent) => {
    api.messageClients(message);
  };

  app.enqueueRun = (run: LightningPlan, workerId = 'rte') => {
    state.runs[run.id] = run;
    state.results[run.id] = {
      workerId, // TODO
      state: null,
    };
    state.pending[run.id] = {
      status: 'queued',
      logs: [],
      steps: {},
    };
    state.queue.push(run.id);
  };

  app.getRun = (id: string) => state.runs[id];

  app.getState = () => state;

  // Promise which returns when a workflow is complete
  app.waitForResult = (runId: string) => {
    return new Promise((resolve) => {
      const handler = (evt: {
        payload: RunCompletePayload;
        runId: string;
        _state: ServerState;
        dataclip: any;
      }) => {
        if (evt.runId === runId) {
          state.events.removeListener(RUN_COMPLETE, handler);
          resolve(evt.payload.final_state);
        }
      };
      state.events.addListener(RUN_COMPLETE, handler);
    });
  };

  app.reset = () => {
    state.queue = [];
    state.results = {};
    state.events.removeAllListeners();
  };

  app.getQueueLength = () => state.queue.length;

  app.getResult = (runId: string) => state.results[runId]?.state;

  app.startRun = (runId: string) => api.startRun(runId);

  // TODO probably remove?
  app.registerRun = (run: any) => {
    state.runs[run.id] = run;
  };

  // TODO these are overriding koa's event handler - should I be doing something different?

  // @ts-ignore
  app.on = (event: LightningEvents, fn: (evt: any) => void) => {
    state.events.addListener(event, fn);
  };

  // @ts-ignore
  app.removeAllListeners = () => {
    state.events.removeAllListeners();
  };

  // @ts-ignore
  app.once = (event: LightningEvents, fn: (evt: any) => void) => {
    state.events.once(event, fn);
  };

  app.onSocketEvent = (
    event: LightningEvents,
    runId: string,
    fn: (evt: any) => void,
    once = true
  ): (() => void) => {
    const unsubscribe = () => state.events.removeListener(event, handler);
    function handler(e: any) {
      if (e.runId && e.runId === runId) {
        if (once) {
          unsubscribe();
        }
        fn(e);
      } else {
        fn(e);
      }
    }
    state.events.addListener(event, handler);
    return unsubscribe;
  };
};

// Set up some rest endpoints
// Note that these are NOT prefixed
const setupRestAPI = (
  app: DevServer,
  state: ServerState,
  logger: Logger
): Koa.Middleware => {
  const router = new Router();

  router.post('/run', (ctx) => {
    const run = ctx.request.body as LightningPlan;

    if (!run) {
      ctx.response.status = 400;
      return;
    }

    logger.info('Adding new run to queue:', run.id);
    logger.debug(run);

    if (!run.id) {
      run.id = crypto.randomUUID();
      logger.info('Generating new id for incoming run:', run.id);
    }

    // convert credentials and dataclips
    run.jobs.forEach((job) => {
      if (job.credential && typeof job.credential !== 'string') {
        const cid = crypto.randomUUID();
        state.credentials[cid] = job.credential;
        job.credential = cid;
      }
    });

    app.enqueueRun(run);

    // triggering wakeup in all connected workers
    if ('wakeup' in ctx.query) {
      logger.info(
        'WAKE UP! Sending work-available event to all listening workers'
      );
      app.messageSocketClients({
        topic: 'worker:queue',
        event: 'work-available',
        payload: {},
        join_ref: '',
        ref: '',
      });
    }
    ctx.response.status = 200;
  });

  return router.routes() as unknown as Koa.Middleware;
};

export default (
  app: DevServer,
  state: ServerState,
  logger: Logger,
  api: Api
): Koa.Middleware => {
  setupDevAPI(app, state, logger, api);
  return setupRestAPI(app, state, logger);
};
