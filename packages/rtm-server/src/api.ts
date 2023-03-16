import Router from '@koa/router';

import healthcheck from './middleware/healthcheck';
// this defines the main API routes in a nice central place

// So what is the API of this server?
// It's mostly a pull model, apart from I think the healthcheck
const createAPI = () => {
  const router = new Router();

  router.get('/healthcheck', healthcheck);

  return router;
};

export default createAPI;
