import test from 'ava';
import { attempts } from '../../src/mock/data';
import createLightningServer, { API_PREFIX } from '../../src/mock/lightning';
import { createMockLogger } from '@openfn/logger';

import phx from 'phoenix-channels';

import { CLAIM } from '../../src/events';

const endpoint = 'ws://localhost:7777/api';

const baseUrl = `http://localhost:7777${API_PREFIX}`;

const sleep = (duration = 10) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

let server;
let client;

// Set up a lightning server and a phoenix socket client before each test
test.before(
  () =>
    new Promise((done) => {
      server = createLightningServer({ port: 7777 });

      client = new phx.Socket(endpoint);
      client.connect();
      client.onOpen(done);
    })
);

test.afterEach(() => {
  server.reset();
});

test.after(() => {
  server.destroy();
});

const join = (channelName: string): Promise<typeof phx.Channel> =>
  new Promise((done) => {
    const channel = client.channel(channelName, {});
    channel.join().receive('ok', () => {
      done(channel);
    });
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

test.serial('provide a phoenix websocket at /api', (t) => {
  // client should be connected before this test runs
  t.is(client.connectionState(), 'open');
});

test.serial('respond to connection join requests', (t) => {
  return new Promise(async (done) => {
    const channel = client.channel('x', {});

    channel.join().receive('ok', (resp) => {
      t.is(resp, 'ok');
      done();
    });
  });
});

// TODO: only allow authorised workers to join workers
// TODO: only allow authorised attemtps to join an attempt channel

test.serial('get a reply to a ping event', (t) => {
  return new Promise(async (done) => {
    const channel = await join('test');

    channel.on('pong', (payload) => {
      t.pass('message received');
      done();
    });

    channel.push('ping');
  });
});

test.serial.only(
  'claim attempt: reply for zero items if queue is empty',
  (t) =>
    new Promise(async (done) => {
      t.is(server.getQueueLength(), 0);

      const channel = await join('workers');

      // response is an array of attempt ids
      channel.push(CLAIM).receive('ok', (response) => {
        t.assert(Array.isArray(response));
        t.is(response.length, 0);

        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

test.serial.only(
  "claim attempt: reply with an attempt id if there's an attempt in the queue",
  (t) =>
    new Promise(async (done) => {
      server.enqueueAttempt(attempt1);
      t.is(server.getQueueLength(), 1);

      // This uses a shared channel at all workers sit in
      // They all yell from time to time to ask for work
      // Lightning responds with an attempt id and server id (target)
      // What if:
      // a) each worker has its own channel, so claims are handed out privately
      // b) we use the 'ok' status to return work in the response
      // this b pattern is much nicer
      const channel = await join('workers');

      // response is an array of attempt ids
      channel.push(CLAIM).receive('ok', (response) => {
        t.truthy(response);
        t.is(response.length, 1);
        t.is(response[0], 'attempt-1');

        // ensure the server state has changed
        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

// TODO is it even worth doing this? Easier for a socket to pull one at a time?
// It would also ensure better distribution if 10 workers ask at the same time, they'll get
// one each then come back for more
test.serial.skip(
  'claim attempt: reply with multiple attempt ids',
  (t) =>
    new Promise(async (done) => {
      server.enqueueAttempt(attempt1);
      server.enqueueAttempt(attempt1);
      server.enqueueAttempt(attempt1);
      t.is(server.getQueueLength(), 3);

      const channel = await join('workers');

      // // response is an array of attempt ids
      // channel.push(CLAIM, { count: 3 }).receive('ok', (response) => {
      //   t.truthy(response);
      //   t.is(response.length, 1);
      //   t.is(response[0], 'attempt-1');

      //   // ensure the server state has changed
      //   t.is(server.getQueueLength(), 0);
      //   done();
      // });
    })
);

// TODO get execution plan
// TODO get credentials
// TODO get state

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
