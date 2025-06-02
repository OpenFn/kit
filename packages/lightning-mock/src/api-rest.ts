import Koa from 'koa';
import Router from '@koa/router';
import { Logger } from '@openfn/logger';

import { ServerState } from './server';
import type { DevServer, LightningEvents } from './types';

const proj = {
  id: '4adf2644-ed4e-4f97-a24c-ab35b3cb1efa',
  name: 'openhie-project',
  description: null,
  inserted_at: '2024-06-10T00:01:10',
  updated_at: '2024-06-10T00:01:10',
  scheduled_deletion: null,
  dataclip_retention_period: null,
  history_retention_period: null,
  requires_mfa: false,
  retention_policy: 'retain_all',
  workflows: {
    'OpenHIE-Workflow': {
      id: '4cc8cd89-39ae-4f7f-a1f2-5b43944519b6',
      name: 'OpenHIE Workflow',
      inserted_at: '2024-06-10T00:01:10Z',
      updated_at: '2024-06-10T12:59:48Z',
      project_id: '4adf2644-ed4e-4f97-a24c-ab35b3cb1efa',
      deleted_at: null,
      lock_version: 10,
      triggers: {},
      jobs: {},
      edges: {},
    },
  },
};

export default (
  app: DevServer,
  state: ServerState,
  logger: Logger,
  api: Api
): Koa.Middleware => {
  const router = new Router();

  router.get('/api/provision/:id', (ctx) => {
    // just return a hard-coded project for now
    ctx.response.body = {
      ...proj,
      id: ctx.params.id,
    };
  });

  router.post('/api/provision', (ctx) => {
    // const project = ctx.request.body as LightningPlan;
    // TODO just return 200 for now

    ctx.response.status = 200;
  });

  return router.routes() as unknown as Koa.Middleware;
};
