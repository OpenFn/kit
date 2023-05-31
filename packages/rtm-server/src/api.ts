import Router from '@koa/router';

import healthcheck from './middleware/healthcheck';
import workflow from './middleware/workflow';

// this defines the main API routes in a nice central place

// So what is the API of this server?
// It's mostly a pull model, apart from I think the healthcheck
// Should have diagnostic and reporting APIs
// maybe even a simple frontend?

const createAPI = (logger, execute) => {
  const router = new Router();

  router.get('/healthcheck', healthcheck);

  // Dev API to run a workflow
  router.post('/workflow', workflow(execute, logger));

  return router;
};

export default createAPI;
