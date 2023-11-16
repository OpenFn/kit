import test from 'ava';

import { setup } from '../util';
import { attempts } from '../data';
import { ATTEMPT_START } from '../../src/events';

let server;
let client;

const port = 5555;

const attempt1 = attempts['attempt-1'];

type Channel = any; // TODO

test.before(async () => ({ server, client } = await setup(port)));

const join = (attemptId: string): Promise<Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(`attempt:${attemptId}`, { token: 'a.b.c' });
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err) => {
        reject(new Error(err));
      });
  });

test.serial('acknowledge attempt:start', async (t) => {
  return new Promise(async (done) => {
    server.registerAttempt(attempt1);
    server.startAttempt(attempt1.id);

    const event = {};

    const channel = await join(attempt1.id);

    channel.push(ATTEMPT_START, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});

// TODO idk how much sense this makes as we have to join the channel first?
// I guess it covers a case where get in the channel but then something goes wrong
// like maybe we send two starts, one after completion
test.serial('reject attempt:start for an unknown attempt', async (t) => {
  return new Promise(async (done) => {
    const event = {};

    // Note that the mock is currently lenient here
    const channel = await join(attempt1.id);

    channel.push(ATTEMPT_START, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});
