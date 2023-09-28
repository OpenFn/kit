// @ts-ignore
import Router from '@koa/router';
import type { Logger } from '@openfn/logger';

import healthcheck from './middleware/healthcheck';
import workflow from './middleware/workflow';

// this defines the main API routes in a nice central place

// So what is the API of this server?
// It's mostly a pull model, apart from I think the healthcheck
// Should have diagnostic and reporting APIs
// maybe even a simple frontend?

const createAPI = (app: any, logger: Logger) => {
  const router = new Router();

  router.get('/healthcheck', healthcheck);

  // Dev API to run a workflow
  // This is totally wrong now
  // router.post('/workflow', workflow(execute, logger));

  app.use(router.routes());
  app.use(router.allowedMethods());

  return router;
};

export default createAPI;
