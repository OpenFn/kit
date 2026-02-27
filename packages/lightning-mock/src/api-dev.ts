/*
 * This module sets up a bunch of dev-only APIs
 * These are not intended to be reflected in Lightning itself
 */
import { createHash } from 'node:crypto';
import Koa from 'koa';
import crypto from 'node:crypto';
import Router from '@koa/router';
import { Logger } from '@openfn/logger';
import type {
  LightningPlan,
  RunCompletePayload,
  Provisioner,
} from '@openfn/lexicon/lightning';

import { ServerState } from './server';
import { RUN_COMPLETE } from './events';
import type { DevServer, LightningEvents } from './types';
import { PhoenixEvent } from './socket-server';

function hashWorkflow(wf: any): string {
  const pick = (obj: any, keys: string[]) => {
    const out: any = {};
    keys.forEach((k) => {
      if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
  };

  const data = {
    name: wf.name,
    jobs: Object.values(wf.jobs ?? {})
      .map((j: any) =>
        pick(j, [
          'name',
          'adaptor',
          'body',
          'project_credential_id',
          'keychain_credential_id',
        ])
      )
      .sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? '')),
    triggers: Object.values(wf.triggers ?? {})
      .map((t: any) => pick(t, ['type', 'cron_expression', 'enabled']))
      .sort((a: any, b: any) => (a.type ?? '').localeCompare(b.type ?? '')),
    edges: Object.values(wf.edges ?? {})
      .map((e: any) =>
        pick(e, [
          'condition_type',
          'condition_label',
          'condition_expression',
          'enabled',
        ])
      )
      .sort((a: any, b: any) =>
        (a.condition_type ?? '').localeCompare(b.condition_type ?? '')
      ),
  };

  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 12);
}

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

  app.addProject = (project: Provisioner.Project_v1) => {
    state.projects[project.id] = project;
  };

  app.updateWorkflow = (projectId: string, wf: Provisioner.Workflow) => {
    const project = state.projects[projectId];
    if (!project) {
      throw new Error(`updateWorkflow: project ${projectId} not found`);
    }
    const now = new Date().toISOString();

    const _newHash = hashWorkflow(wf);

    const _exists = Object.values(project.workflows).find((wf) => {
      wf.id === wf.id;
    });

    if (!_exists) {
      const new_workflow = {
        ...wf,
        lock_version: wf.lock_version ?? 1,
        inserted_at: now,
        updated_at: now,
        deleted_at: wf.deleted_at ?? null,
        version_history: [_newHash],
      };
      // @ts-ignore
      project.workflows = [...Object.values(project.workflows), new_workflow];
    } else {
      // if existing. update it
      const existingHash = hashWorkflow(_exists);

      if (_newHash !== existingHash) {
        const prevHistory: string[] = _exists.version_history ?? [];
        const newHistory =
          prevHistory.length > 0
            ? [...prevHistory.slice(0, -1), _newHash] // squash
            : [_newHash];

        // @ts-ignore
        project.workflows = Object.values(project.workflows).map((wf) => {
          if (wf.id === _exists.id) {
            return {
              ..._exists,
              ...wf,
              lock_version: (_exists.lock_version ?? 1) + 1,
              updated_at: now,
              version_history: newHistory,
            };
          }
        });
      }
    }

    const workflows = project.workflows as Record<string, any>;
    const w = wf as any;

    if (w.delete) {
      const key = Object.keys(workflows).find((k) => workflows[k].id === w.id);
      if (key) delete workflows[key];
      return;
    }

    const existingEntry = Object.entries(workflows).find(
      ([, v]: any) => v.id === w.id
    ) as [string, any] | undefined;

    const newHash = hashWorkflow(w);

    if (!existingEntry) {
      workflows[w.id] = {
        ...w,
        lock_version: w.lock_version ?? 1,
        inserted_at: now,
        updated_at: now,
        deleted_at: w.deleted_at ?? null,
        version_history: [newHash],
      };
    } else {
      const [existingKey, existingWf] = existingEntry;
      const existingHash = hashWorkflow(existingWf);

      if (newHash !== existingHash) {
        const prevHistory: string[] = existingWf.version_history ?? [];
        const newHistory =
          prevHistory.length > 0
            ? [...prevHistory.slice(0, -1), newHash] // squash
            : [newHash];

        workflows[existingKey] = {
          ...existingWf,
          ...w,
          lock_version: (existingWf.lock_version ?? 1) + 1,
          updated_at: now,
          version_history: newHistory,
        };
      }
    }
  };

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
    state.projects = {};
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
