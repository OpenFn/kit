import test from 'ava';
import axios from 'axios';

import createLightningServer from '../../src/mock/lightning';
import { wait } from '../util';

const baseUrl = 'http://localhost:8888';

let server = createLightningServer({ port: 8888 });

const get = (path: string) => axios.get(`${baseUrl}/${path}`);
const post = (path: string, data: any) =>
  axios.post(`${baseUrl}/${path}`, data);

test.serial('GET /job - return 404 if no job', async (t) => {
  try {
    await get('job/x');
  } catch (e) {
    t.is(e.response.status, 404);
  }
});

test.serial('GET /job - return a job', async (t) => {
  const { status, data: job } = await get('job/job-1');
  t.is(status, 200);

  t.is(job.id, 'job-1');
  t.truthy(job.expression);
});

test.serial('GET /job - return a new mock job', async (t) => {
  server.addJob({ id: 'jam' });
  const { status, data: job } = await get('job/jam');
  t.is(status, 200);

  t.is(job.id, 'jam');
});

test.serial('GET /workflow - return 404 if no workflow', async (t) => {
  try {
    await get('workflow/x');
  } catch (e) {
    t.is(e.response.status, 404);
  }
});

test.serial('GET /workflow - return a workflow', async (t) => {
  const { status, data: workflow } = await get('workflow/workflow-1');
  t.is(status, 200);

  t.is(workflow.id, 'workflow-1');
});

test.serial('GET /workflow - return a new mock workflow', async (t) => {
  server.addWorkflow({ id: 'jam' });
  const { status, data: workflow } = await get('workflow/jam');
  t.is(status, 200);

  t.is(workflow.id, 'jam');
});

test.serial('GET /queue - return 204 for an empty queue', async (t) => {
  const { status, data } = await get('queue');
  t.is(status, 204);

  t.falsy(data);
});

test.serial('GET /queue - return 200 with a workflow id', async (t) => {
  server.addToQueue('workflow-1');
  const { status, data } = await get('queue');
  t.is(status, 200);

  t.truthy(data);
  t.is(data.workflowId, 'workflow-1');
});

test.serial('GET /queue - clear the queue after a request', async (t) => {
  server.addToQueue('workflow-1');
  const req1 = await get('queue');
  t.is(req1.status, 200);

  t.is(req1.data.workflowId, 'workflow-1');

  const req2 = await get('queue');
  t.is(req2.status, 204);
  t.falsy(req2.data);
});

test.serial('POST /notify - should return 202', async (t) => {
  const { status } = await post('notify', {});
  t.is(status, 202);
});

test.serial('POST /notify - should echo to event emitter', async (t) => {
  let evt;
  let didCall = false;
  //server.once('notify', (e) => (evt = e));
  server.once('notify', (e) => {
    didCall = true;
    evt = e;
  });

  const { status } = await post('notify', {
    event: 'job-start',
    workflowId: 'workflow-1',
  });
  t.is(status, 202);
  t.true(didCall);
  // await wait(() => evt);

  // t.truthy(evt);
  // t.is(evt.workflowId, 'job-start');
  // t.is(evt.workflowId, 'workflow-1');
});
