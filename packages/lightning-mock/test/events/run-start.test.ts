import test from 'ava';
import { join, setup, createRun } from '../util';
import { RUN_START } from '../../src/events';

let server: any;
let client: any;

const port = 5500;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('acknowledge run:start', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {};

    const channel = await join(client, run.id);

    channel.push(RUN_START, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('reject run:start for an unknown run', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();
    const event = {};

    server.startRun(run.id);

    // Note that the mock is currently lenient here
    const channel = await join(client, run.id);

    // Sneak into the server and kill the state for this run
    delete server.state.pending[run.id];

    channel.push(RUN_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

test.serial('reject run:start for a completed run', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();
    const event = {};

    server.startRun(run.id);

    // Note that the mock is currently lenient here
    const channel = await join(client, run.id);

    // Sneak into the server and update the state for this run
    server.state.pending[run.id].status = 'completed';

    channel.push(RUN_START, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});
