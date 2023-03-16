import Koa from 'koa';
import Router from '@koa/router';

// a mock lightning server
const createLightningServer = (options = {}) => {
  const app = new Koa();

  const queue: string[] = [];
  const workflows = {};
  const jobs = {};

  const router = new Router();

  router.get('/workflow/:id', () => {});

  router.get('/job/:id', () => {});

  router.get('/queue', (ctx) => {
    console.log('***');
    const first = queue.shift();
    if (first) {
      console.log(first);
      ctx.body = JSON.stringify({ workflowId: first });
    } else {
      ctx.body = undefined;
    }
    ctx.status = 200;
  });

  app.addToQueue = (workflowId: string) => {
    console.log('add to queue', workflowId);
    queue.push(workflowId);
  };

  app.use(router.routes());
  app.use(router.allowedMethods());

  app.listen(options.port || 8888);

  return app;
};

export default createLightningServer;
