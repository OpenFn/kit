import test from 'ava';
import { attempts } from '../../src/mock/data';
import createLightningServer, { API_PREFIX } from '../../src/mock/lightning';
import { createMockLogger } from '@openfn/logger';

import phx from 'phoenix-channels';
const { Socket } = phx;

const baseUrl = `http://localhost:7777${API_PREFIX}`;

const sleep = (duration = 10) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

let server;

test.before(() => {
  server = createLightningServer({ port: 7777 });
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

test.serial('provide a phoenix websocket at /websocket', (t) => {
  return new Promise(async (done) => {
    const socket = new Socket(`ws://localhost:7777/api`);

    socket.connect();
    await sleep(); // TODO untidy
    t.is(socket.connectionState(), 'open');
    done();
  });
});

test.serial('respond to connection join requests', (t) => {
  return new Promise(async (done) => {
    const socket = new Socket(`ws://localhost:7777/api`);

    socket.connect();
    const channel = socket.channel('x', {});

    channel.join().receive('ok', (resp) => {
      t.is(resp, 'ok');
      done();
    });
  });
});

// Thinking a bit about messaging flow
// a) it's not working (no connect, no join)
// b) the way this is written is awful
test.serial('get a reply to a ping event', (t) => {
  return new Promise(async (done) => {
    let didGetReply = false;
    const socket = new Socket(`ws://localhost:7777/api`);

    socket.connect();
    // join the worker pool
    const channel = socket.channel('workers', {});
    channel.join().receive('ok', () => {
      // should get a response
      channel.on('pong', (payload) => {
        console.log('[ping] reply', payload);
        didGetReply = true;

        t.true(didGetReply);
        done();
      });

      // TODO explicit test that the backing socket got this event?
      channel.push('ping');
    });
  });
});

// respond to a claim request with an id
// uh does this stuff make any sense in the socket model?

// create a channel for an attempt

test.serial.skip(
  'GET /credential - return 404 if no credential found',
  async (t) => {
    const res = await get('credential/x');
    t.is(res.status, 404);
  }
);

test.serial.skip('GET /credential - return a credential', async (t) => {
  server.addCredential('a', { user: 'johnny', password: 'cash' });

  const res = await get('credential/a');
  t.is(res.status, 200);

  const job = await res.json();

  t.is(job.user, 'johnny');
  t.is(job.password, 'cash');
});

test.serial.skip(
  'POST /attempts/next - return 204 and no body for an empty queue',
  async (t) => {
    t.is(server.getQueueLength(), 0);
    const res = await post('attempts/next', { rtm_id: 'rtm' });
    t.is(res.status, 204);
    t.false(res.bodyUsed);
  }
);

test.serial.skip(
  'POST /attempts/next - return 400 if no id provided',
  async (t) => {
    const res = await post('attempts/next', {});
    t.is(res.status, 400);
  }
);

test.serial.skip(
  'GET /attempts/next - return 200 with a workflow',
  async (t) => {
    server.enqueueAttempt(attempt1);
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
  }
);

test.serial.skip(
  'GET /attempts/next - return 200 with a workflow with an inline item',
  async (t) => {
    server.enqueueAttempt({ id: 'abc' });
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

test.serial.skip(
  'GET /attempts/next - return 200 with 2 workflows',
  async (t) => {
    server.enqueueAttempt(attempt1);
    server.enqueueAttempt(attempt1);
    server.enqueueAttempt(attempt1);
    t.is(server.getQueueLength(), 3);

    const res = await post('attempts/next?count=2', { rtm_id: 'rtm' });
    t.is(res.status, 200);

    const result = await res.json();
    t.truthy(result);
    t.true(Array.isArray(result));
    t.is(result.length, 2);

    t.is(server.getQueueLength(), 1);
  }
);

test.serial.skip(
  'POST /attempts/next - clear the queue after a request',
  async (t) => {
    server.enqueueAttempt(attempt1);
    const res1 = await post('attempts/next', { rtm_id: 'rtm' });
    t.is(res1.status, 200);

    const result1 = await res1.json();
    t.is(result1.length, 1);
    const res2 = await post('attempts/next', { rtm_id: 'rtm' });
    t.is(res2.status, 204);
    t.falsy(res2.bodyUsed);
  }
);

test.serial.skip('POST /attempts/log - should return 200', async (t) => {
  server.enqueueAttempt(attempt1);
  const { status } = await post('attempts/log/attempt-1', {
    rtm_id: 'rtm',
    logs: [{ message: 'hello world' }],
  });
  t.is(status, 200);
});

test.serial.skip(
  'POST /attempts/log - should return 400 if no rtm_id',
  async (t) => {
    const { status } = await post('attempts/log/attempt-1', {
      rtm_id: 'rtm',
      logs: [{ message: 'hello world' }],
    });
    t.is(status, 400);
  }
);

test.serial.skip(
  'POST /attempts/log - should echo to event emitter',
  async (t) => {
    server.enqueueAttempt(attempt1);
    let evt;
    let didCall = false;

    server.once('log', (e) => {
      didCall = true;
      evt = e;
    });

    const { status } = await post('attempts/log/attempt-1', {
      rtm_id: 'rtm',
      logs: [{ message: 'hello world' }],
    });
    t.is(status, 200);
    t.true(didCall);

    t.truthy(evt);
    t.is(evt.id, 'attempt-1');
    t.deepEqual(evt.logs, [{ message: 'hello world' }]);
  }
);

test.serial.skip('POST /attempts/complete - return final state', async (t) => {
  server.enqueueAttempt(attempt1);
  const { status } = await post('attempts/complete/attempt-1', {
    rtm_id: 'rtm',
    state: {
      x: 10,
    },
  });
  t.is(status, 200);
  const result = server.getResult('attempt-1');
  t.deepEqual(result, { x: 10 });
});

test.serial.skip(
  'POST /attempts/complete - reject if unknown rtm',
  async (t) => {
    const { status } = await post('attempts/complete/attempt-1', {
      rtm_id: 'rtm',
      state: {
        x: 10,
      },
    });
    t.is(status, 400);
    t.falsy(server.getResult('attempt-1'));
  }
);

test.serial.skip(
  'POST /attempts/complete - reject if unknown workflow',
  async (t) => {
    server.enqueueAttempt({ id: 'b' }, 'rtm');

    const { status } = await post('attempts/complete/attempt-1', {
      rtm_id: 'rtm',
      state: {
        x: 10,
      },
    });

    t.is(status, 400);
    t.falsy(server.getResult('attempt-1'));
  }
);

test.serial.skip(
  'POST /attempts/complete - echo to event emitter',
  async (t) => {
    server.enqueueAttempt(attempt1);
    let evt;
    let didCall = false;

    server.once('attempt-complete', (e) => {
      didCall = true;
      evt = e;
    });

    const { status } = await post('attempts/complete/attempt-1', {
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
    t.is(evt.workflow_id, 'attempt-1');
    t.deepEqual(evt.state, { data: { answer: 42 } });
  }
);

// test lightning should get the finished state through a helper API
