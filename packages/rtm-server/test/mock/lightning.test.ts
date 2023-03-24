import test from 'ava';
import axios from 'axios';

import createLightningServer, { API_PREFIX } from '../../src/mock/lightning';

const baseUrl = `http://localhost:8888${API_PREFIX}`;

let server;

test.beforeEach(() => {
  server = createLightningServer({ port: 8888 });
});

test.afterEach(() => {
  server.destroy();
});

const get = (path: string) => axios.get(`${baseUrl}/${path}`);
const post = (path: string, data: any) =>
  axios.post(`${baseUrl}/${path}`, data);

test.serial('GET /credential - return a credential', async (t) => {
  const { status, data: job } = await get('credential/a');
  t.is(status, 200);

  t.is(job.user, 'bobby');
  t.is(job.password, 'password1');
});

test.serial('GET /credential - return a new mock credential', async (t) => {
  server.addCredential('b', { user: 'johnny', password: 'cash' });
  const { status, data: job } = await get('credential/b');
  t.is(status, 200);

  t.is(job.user, 'johnny');
  t.is(job.password, 'cash');
});

test.serial(
  'GET /credential - return 404 if no credential found',
  async (t) => {
    try {
      await get('credential/c');
    } catch (e) {
      t.is(e.response.status, 404);
    }
  }
);

test.serial(
  'POST /attempts/next - return 204 for an empty queue',
  async (t) => {
    t.is(server.getQueueLength(), 0);
    const { status, data } = await post('attempts/next', { id: 'x' });
    t.is(status, 204);

    t.falsy(data);
  }
);

test.serial('POST /attempts/next - return 400 if no id provided', async (t) => {
  try {
    await post('attempts/next', {});
  } catch (e) {
    t.is(e.response.status, 400);
  }
});

test.serial('GET /attempts/next - return 200 with a workflow', async (t) => {
  server.addToQueue('attempt-1');
  t.is(server.getQueueLength(), 1);
  const { status, data } = await post('attempts/next', { id: 'x' });
  t.is(status, 200);

  t.truthy(data);
  t.true(Array.isArray(data));
  t.is(data.length, 1);

  // not interested in testing much against the attempt structure at this stage
  const [attempt] = data;
  t.is(attempt.id, 'attempt-1');
  t.true(Array.isArray(attempt.plan));

  t.is(server.getQueueLength(), 0);
});

test.serial(
  'GET /attempts/next - return 200 with a workflow with an inline item',
  async (t) => {
    server.addToQueue({ id: 'abc' });
    t.is(server.getQueueLength(), 1);
    const { status, data } = await post('attempts/next', { id: 'x' });
    t.is(status, 200);

    t.truthy(data);
    t.true(Array.isArray(data));
    t.is(data.length, 1);

    const [attempt] = data;
    t.is(attempt.id, 'abc');

    t.is(server.getQueueLength(), 0);
  }
);

test.serial('GET /attempts/next - return 200 with 2 workflows', async (t) => {
  server.addToQueue('attempt-1');
  server.addToQueue('attempt-1');
  server.addToQueue('attempt-1');
  t.is(server.getQueueLength(), 3);
  const { status, data } = await post('attempts/next?count=2', { id: 'x' });
  t.is(status, 200);

  t.truthy(data);
  t.true(Array.isArray(data));
  t.is(data.length, 2);

  t.is(server.getQueueLength(), 1);
});

test.serial(
  'POST /attempts/next - clear the queue after a request',
  async (t) => {
    server.addToQueue('attempt-1');
    const req1 = await post('attempts/next', { id: 'x' });
    t.is(req1.status, 200);

    t.is(req1.data.length, 1);

    const req2 = await post('attempts/next', { id: 'x' });
    t.is(req2.status, 204);
    t.falsy(req2.data);
  }
);

test.serial('POST /attempts/notify - should return 200', async (t) => {
  const { status } = await post('attempts/notify/a', {});
  t.is(status, 200);
});

test.serial(
  'POST /attempts/notify - should echo to event emitter',
  async (t) => {
    let evt;
    let didCall = false;

    server.once('notify', (e) => {
      didCall = true;
      evt = e;
    });

    const { status } = await post('attempts/notify/a', {
      event: 'job-start',
      count: 101,
    });
    t.is(status, 200);
    t.true(didCall);
    // await wait(() => evt);

    t.truthy(evt);
    t.is(evt.id, 'a');
    t.is(evt.name, 'job-start');
    t.is(evt.count, 101);
  }
);

test.serial('POST /attempts/complete - return final state', async (t) => {
  const { status } = await post('attempts/complete/a', {
    x: 10,
  });
  t.is(status, 200);
  const result = server.getResult('a');
  t.deepEqual(result, { x: 10 });
});

test.serial(
  'POST /attempts/complete - should echo to event emitter',
  async (t) => {
    let evt;
    let didCall = false;

    server.once('complete', (e) => {
      didCall = true;
      evt = e;
    });

    const { status } = await post('attempts/complete/a', {
      data: {
        answer: 42,
      },
    });
    t.is(status, 200);
    t.true(didCall);

    t.truthy(evt);
    t.is(evt.id, 'a');
    t.deepEqual(evt.state, { data: { answer: 42 } });
  }
);

// test lightning should get the finished state through a helper API
