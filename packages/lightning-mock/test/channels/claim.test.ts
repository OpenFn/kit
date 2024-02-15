import test from 'ava';

import { setup } from '../util';
import { runs } from '../data';
import { CLAIM } from '../../src/events';

const port = 4444;

type Channel = any;

let server: any;
let client: any;

test.before(async () => ({ server, client } = await setup(port)));

test.afterEach(() => {
  server.reset();
});

test.after(() => {
  server.destroy();
});

const run1 = runs['run-1'];

const join = (channelName: string, params: any = {}): Promise<Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(channelName, params);
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err: any) => {
        // err will be the response message on the payload (ie, invalid_token, invalid_run_id etc)
        reject(new Error(err));
      });
  });

test.serial(
  'claim run: reply for zero items if queue is empty',
  (t) =>
    new Promise(async (done) => {
      t.is(server.getQueueLength(), 0);

      const channel = await join('worker:queue');

      // response is an array of run ids
      channel.push(CLAIM).receive('ok', (response: any) => {
        const { runs } = response;
        t.assert(Array.isArray(runs));
        t.is(runs.length, 0);

        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

test.serial(
  "claim run: reply with an run id if there's an run in the queue",
  (t) =>
    new Promise(async (done) => {
      server.enqueueRun(run1);
      t.is(server.getQueueLength(), 1);

      const channel = await join('worker:queue');

      // response is an array of run ids
      channel.push(CLAIM).receive('ok', (response: any) => {
        const { runs } = response;
        t.truthy(runs);
        t.is(runs.length, 1);
        t.deepEqual(runs[0], { id: 'run-1', token: 'x.y.z' });

        // ensure the server state has changed
        t.is(server.getQueueLength(), 0);
        done();
      });
    })
);

// TODO is it even worth doing this? Easier for a socket to pull one at a time?
// It would also ensure better distribution if 10 workers ask at the same time, they'll get
// one each then come back for more
test.todo('claim run: reply with multiple run ids');

test.todo('token auth');
