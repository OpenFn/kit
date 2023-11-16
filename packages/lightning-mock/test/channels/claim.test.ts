import test from 'ava';

import { setup } from '../util';
import { attempts } from '../data';
import { CLAIM } from '../../src/events';

const port = 4444;

type Channel = any;

let server;
let client;

test.before(async () => ({ server, client } = await setup(port)));

test.afterEach(() => {
  server.reset();
});

test.after(() => {
  server.destroy();
});

const attempt1 = attempts['attempt-1'];

const join = (channelName: string, params: any = {}): Promise<Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(channelName, params);
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err) => {
        // err will be the response message on the payload (ie, invalid_token, invalid_attempt_id etc)
        reject(new Error(err));
      });
  });

test.serial(
  'claim attempt: reply for zero items if queue is empty',
  (t) =>
    new Promise(async (done) => {
      t.is(server.getQueueLength(), 0);

      const channel = await join('worker:queue');

      // response is an array of attempt ids
      channel.push(CLAIM).receive('ok', (response) => {
        const { attempts } = response;
        t.assert(Array.isArray(attempts));
        t.is(attempts.length, 0);

        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

test.serial(
  "claim attempt: reply with an attempt id if there's an attempt in the queue",
  (t) =>
    new Promise(async (done) => {
      server.enqueueAttempt(attempt1);
      t.is(server.getQueueLength(), 1);

      const channel = await join('worker:queue');

      // response is an array of attempt ids
      channel.push(CLAIM).receive('ok', (response) => {
        const { attempts } = response;
        t.truthy(attempts);
        t.is(attempts.length, 1);
        t.deepEqual(attempts[0], { id: 'attempt-1', token: 'x.y.z' });

        // ensure the server state has changed
        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

// TODO is it even worth doing this? Easier for a socket to pull one at a time?
// It would also ensure better distribution if 10 workers ask at the same time, they'll get
// one each then come back for more
test.todo('claim attempt: reply with multiple attempt ids');

test.todo('token auth');
