import { EventEmitter } from 'node:events';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from '@koa/router';

import { Workflow, JobNode } from '../types';
import { RTMEvent } from './runtime-manager';

/*
Expected server API
- GET workflow
- GET job
- GET queue
- POST notify
*/

const workflows = {
  'workflow-1': {
    id: 'workflow-1',
    state: {},
    start: 'job-1',
    plan: [
      {
        id: 'job-1',
        // no expression in the plan
      },
    ],
  },
  'workflow-2': {
    id: 'workflow-1',
    state: {},
    start: 'job-1',
    plan: [
      {
        id: 'job-1',
        upstream: 'job-2',
      },
      {
        id: 'job-2',
      },
    ],
  },
};

const jobs = {
  'job-1': {
    id: 'job-1',
    expression: 'export default [s => s];',
  },
  'job-2': {
    id: 'job-2',
    expression: 'export default [s => s];',
  },
};

type NotifyEvent = {
  event: RTMEvent;
  workflow: string; // workflow id
  [key: string]: any;
};

// a mock lightning server
const createLightningServer = (options = {}) => {
  const app = new Koa();

  const queue: string[] = [];

  const router = new Router();

  const events = new EventEmitter();

  // GET Workflow:
  //  200 - workflow json as body
  //  404 - workflow not found. No body.
  router.get('/workflow/:id', (ctx) => {
    const { id } = ctx.params;
    if (workflows[id]) {
      ctx.status = 200;
      ctx.body = JSON.stringify(workflows[id]);
    } else {
      ctx.status = 404;
    }
  });

  // GET Job:
  //  200 - job json as body
  //  404 - job not found. No body.
  router.get('/job/:id', (ctx) => {
    const { id } = ctx.params;
    if (jobs[id]) {
      ctx.status = 200;
      ctx.body = JSON.stringify(jobs[id]);
    } else {
      ctx.status = 404;
    }
  });

  // TODO I think this is just GET workflow? Or get work?
  // GET queue:
  //  200 - returned a queue item (json in body)
  //  204 - queue empty (no body)
  router.get('/queue', (ctx) => {
    const first = queue.shift();
    if (first) {
      ctx.body = JSON.stringify({ workflowId: first });
      ctx.status = 200;
    } else {
      ctx.body = undefined;
      ctx.status = 204;
    }
  });

  // Notify of some job update
  // proxy to event emitter
  // { event: 'event-name', workflow: 'workflow-id' }
  // TODO cty.body is always undefined ???
  router.post('/notify', (ctx) => {
    const evt = ctx.data as NotifyEvent;
    // console.log(ctx);
    // TODO pull out the payload
    events.emit('notify', evt);

    ctx.status = 202;
  });

  // Dev APIs for unit testing
  app.addWorkflow = (workflow: Workflow) => {
    workflows[workflow.id] = workflow;
  };
  app.addJob = (job: JobNode) => {
    jobs[job.id] = job;
  };
  app.addToQueue = (workflowId: string) => {
    queue.push(workflowId);
  };
  app.on = (event: 'notify', fn: (evt: any) => void) => {
    events.addListener(event, fn);
  };
  app.once = (event: 'notify', fn: (evt: any) => void) => {
    events.once(event, fn);
  };

  app.use(bodyParser());
  app.use(router.routes());
  app.listen(options.port || 8888);

  return app;
};

export default createLightningServer;
