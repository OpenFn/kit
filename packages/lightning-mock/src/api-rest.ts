import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { Logger } from '@openfn/logger';

import { ServerState } from './server';
import type { DevServer } from './types';

export const DEFAULT_PROJECT_ID = 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00';

const proj = {
  id: DEFAULT_PROJECT_ID,
  name: 'aaa',
  description: 'a project',
  concurrency: null,
  inserted_at: '2025-04-23T11:15:59Z',
  collections: [],
  workflows: [
    {
      id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      name: 'wf1',
      edges: [
        {
          enabled: true,
          id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
          source_trigger_id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          condition_type: 'always',
          target_job_id: '66add020-e6eb-4eec-836b-20008afca816',
        },
      ],
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      jobs: [
        {
          id: '66add020-e6eb-4eec-836b-20008afca816',
          name: 'Transform data',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
        },
      ],
      triggers: [
        {
          enabled: true,
          id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          type: 'webhook',
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
  ],
  updated_at: '2025-04-23T11:15:59Z',
  project_credentials: [],
  scheduled_deletion: null,
  allow_support_access: false,
  requires_mfa: false,
  retention_policy: 'retain_all',
  history_retention_period: null,
  dataclip_retention_period: null,
};

// TODO not sure this is consistent
const yaml = `name: aaa
workflows:
  wf1:
    name: wf1
    jobs:
      transform-data:
        name: Transform data
        adaptor: '@openfn/language-common@latest'
        body: fn(s => s)
    triggers:
      webhook:
        type: webhook
        enabled: true
    edges:
      webhook->transform-data:
        source_trigger: webhook
        target_job: transform-data
        condition_type: always
        enabled: true
`;

export default (
  app: DevServer,
  state: ServerState,
  _logger: Logger,
  _api: any
): Koa.Middleware => {
  const router = new Router();
  router.use(bodyParser());

  // load a sample project as a default
  state.projects[DEFAULT_PROJECT_ID] = proj as any;

  // we also need to provide a yaml endpoint
  router.get('/api/provision/:id', (ctx) => {
    // just return a hard-coded project for now
    if (ctx.params.id === 'yaml') {
      // const { i d} = ctx.query;
      // just return a hard-coded project for now
      ctx.response.body = yaml;
    } else {
      // TODO what if doesn't exist?
      const project = state.projects[ctx.params.id];
      if (project && project.workflows && !Array.isArray(project.workflows)) {
        ctx.response.body = {
          data: { ...project, workflows: Object.values(project.workflows) },
        };
      } else {
        ctx.response.body = { data: project };
      }
    }
  });

  router.post('/api/provision', (ctx) => {
    const incoming: any = ctx.request.body;
    const now = new Date().toISOString();

    if (!state.projects[incoming.id]) {
      state.projects[incoming.id] = {
        ...incoming,
        workflows: [],
        inserted_at: now,
        updated_at: now,
      };
    } else {
      const { workflows: _ignored, ...projectFields } = incoming;
      state.projects[incoming.id] = {
        ...state.projects[incoming.id],
        ...projectFields,
        updated_at: now,
      };
    }

    (incoming.workflows ?? []).forEach((wf: any) => {
      app.updateWorkflow(incoming.id, wf);
    });

    ctx.response.status = 200;
    ctx.response.body = { data: state.projects[incoming.id] };
  });

  // list with query
  router.get('/collections/:name', (ctx) => {
    const { query, ...opts } = ctx.query;
    try {
      ctx.body = app.collections.fetch(ctx.params.name, query, opts);
    } catch (e: any) {
      if ((e.message = 'COLLECTION_NOT_FOUND')) {
        ctx.status = 404;
      }
    }
  });

  // get by key
  router.get('/collections/:name/:key', (ctx) => {
    const { name, key } = ctx.params;
    try {
      const result = app.collections.byKey(name, key);
      ctx.body = {
        key,
        value: result,
      };
    } catch (e: any) {
      if ((e.message = 'COLLECTION_NOT_FOUND')) {
        ctx.status = 404;
      }
    }
  });

  return router.routes() as unknown as Koa.Middleware;
};
