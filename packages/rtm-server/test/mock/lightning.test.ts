import test from 'ava';
import { attempts } from '../../src/mock/data';
import createLightningServer, { API_PREFIX } from '../../src/mock/lightning';

const baseUrl = `http://localhost:8888${API_PREFIX}`;

let server;

test.before(() => {
  server = createLightningServer({ port: 8888 });
});

test.afterEach(() => {
  server.reset();
});

test.after(() => {
  server.destroy();
});

const get = (path: string) => fetch(`${baseUrl}/${path}`);
const post = (path: string, data: any) =>
  fetch(`${baseUrl}/${path}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

const attempt1 = attempts()['attempt-1'];

test.serial(
  'GET /credential - return 404 if no credential found',
  async (t) => {
    const res = await get('credential/x');
    t.is(res.status, 404);
  }
);

test.serial('GET /credential - return a credential', async (t) => {
  server.addCredential('a', { user: 'johnny', password: 'cash' });

  const res = await get('credential/a');
  t.is(res.status, 200);

  const job = await res.json();

  t.is(job.user, 'johnny');
  t.is(job.password, 'cash');
});

test.serial(
  'POST /attempts/next - return 204 and no body for an empty queue',
  async (t) => {
    t.is(server.getQueueLength(), 0);
    const res = await post('attempts/next', { rtm_id: 'rtm' });
    t.is(res.status, 204);
    t.false(res.bodyUsed);
  }
);

test.serial('POST /attempts/next - return 400 if no id provided', async (t) => {
  const res = await post('attempts/next', {});
  t.is(res.status, 400);
});

test.serial('GET /attempts/next - return 200 with a workflow', async (t) => {
  server.addToQueue(attempt1);
  t.is(server.getQueueLength(), 1);

  const res = await post('attempts/next', { rtm_id: 'rtm' });
  const result = await res.json();
  t.is(res.status, 200);

  t.truthy(result);
  t.true(Array.isArray(result));
  t.is(result.length, 1);

  // not interested in testing much against the attempt structure at this stage
  const [attempt] = result;
  t.is(attempt.id, 'attempt-1');
  t.true(Array.isArray(attempt.plan));

  t.is(server.getQueueLength(), 0);
});

test.serial(
  'GET /attempts/next - return 200 with a workflow with an inline item',
  async (t) => {
    server.addToQueue({ id: 'abc' });
    t.is(server.getQueueLength(), 1);

    const res = await post('attempts/next', { rtm_id: 'rtm' });
    t.is(res.status, 200);

    const result = await res.json();
    t.truthy(result);
    t.true(Array.isArray(result));
    t.is(result.length, 1);

    const [attempt] = result;
    t.is(attempt.id, 'abc');

    t.is(server.getQueueLength(), 0);
  }
);

test.serial('GET /attempts/next - return 200 with 2 workflows', async (t) => {
  server.addToQueue(attempt1);
  server.addToQueue(attempt1);
  server.addToQueue(attempt1);
  t.is(server.getQueueLength(), 3);

  const res = await post('attempts/next?count=2', { rtm_id: 'rtm' });
  t.is(res.status, 200);

  const result = await res.json();
  t.truthy(result);
  t.true(Array.isArray(result));
  t.is(result.length, 2);

  t.is(server.getQueueLength(), 1);
});

test.serial(
  'POST /attempts/next - clear the queue after a request',
  async (t) => {
    server.addToQueue(attempt1);
    const res1 = await post('attempts/next', { rtm_id: 'rtm' });
    t.is(res1.status, 200);

    const result1 = await res1.json();
    t.is(result1.length, 1);
    const res2 = await post('attempts/next', { rtm_id: 'rtm' });
    t.is(res2.status, 204);
    t.falsy(res2.bodyUsed);
  }
);

// TODO this API is gonna be restructured
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
  server.addPendingWorkflow('a', 'rtm');
  const { status } = await post('attempts/complete/a', {
    rtm_id: 'rtm',
    state: {
      x: 10,
    },
  });
  t.is(status, 200);
  const result = server.getResult('a');
  t.deepEqual(result, { x: 10 });
});

test.serial('POST /attempts/complete - reject if unknown rtm', async (t) => {
  const { status } = await post('attempts/complete/a', {
    rtm_id: 'rtm',
    state: {
      x: 10,
    },
  });
  t.is(status, 400);
  t.falsy(server.getResult('a'));
});

test.serial(
  'POST /attempts/complete - reject if unknown workflow',
  async (t) => {
    server.addPendingWorkflow('b', 'rtm');

    const { status } = await post('attempts/complete/a', {
      rtm_id: 'rtm',
      state: {
        x: 10,
      },
    });

    t.is(status, 400);
    t.falsy(server.getResult('a'));
  }
);

test.serial('POST /attempts/complete - echo to event emitter', async (t) => {
  server.addPendingWorkflow('a', 'rtm');
  let evt;
  let didCall = false;

  server.once('workflow-complete', (e) => {
    didCall = true;
    evt = e;
  });

  const { status } = await post('attempts/complete/a', {
    rtm_id: 'rtm',
    state: {
      data: {
        answer: 42,
      },
    },
  });
  t.is(status, 200);
  t.true(didCall);

  t.truthy(evt);
  t.is(evt.rtm_id, 'rtm');
  t.is(evt.workflow_id, 'a');
  t.deepEqual(evt.state, { data: { answer: 42 } });
});

// test lightning should get the finished state through a helper API
