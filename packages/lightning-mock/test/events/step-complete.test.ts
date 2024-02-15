import test from 'ava';
import { STEP_COMPLETE } from '../../src/events';

import { join, setup, createRun } from '../util';

let server: any;
let client: any;

const port = 5501;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('acknowledge valid message', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      reason: 'success',
      output_dataclip: JSON.stringify({ x: 22 }),
      output_dataclip_id: 't',
    };

    const channel = await join(client, run.id);

    channel.push(STEP_COMPLETE, event).receive('ok', () => {
      t.pass('event acknowledged');
      done();
    });
  });
});

test.serial('save dataclip id to state', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      reason: 'success',
      output_dataclip: JSON.stringify({ x: 22 }),
      output_dataclip_id: 't',
    };

    const channel = await join(client, run.id);

    channel.push(STEP_COMPLETE, event).receive('ok', () => {
      t.deepEqual(server.state.dataclips.t, JSON.parse(event.output_dataclip));
      done();
    });
  });
});

test.serial('error if no reason', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      reason: undefined,
      output_dataclip: JSON.stringify({ x: 22 }),
      output_dataclip_id: undefined,
    };
    const channel = await join(client, run.id);

    channel.push(STEP_COMPLETE, event).receive('error', () => {
      t.pass('event rejected');
      done();
    });
  });
});

// reason validation code is shared with run:complete
// It's fine not to test further here

test.serial('error if no output dataclip', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      reason: 'success',
      output_dataclip: undefined,
      output_dataclip_id: 'x',
    };
    const channel = await join(client, run.id);

    channel.push(STEP_COMPLETE, event).receive('error', (e: any) => {
      t.is(e.toString(), 'no output_dataclip');
      done();
    });
  });
});

test.serial('error if no output dataclip_id', async (t) => {
  return new Promise(async (done) => {
    const run = createRun();

    server.startRun(run.id);

    const event = {
      reason: 'success',
      output_dataclip: {},
      output_dataclip_id: undefined,
    };
    const channel = await join(client, run.id);

    channel.push(STEP_COMPLETE, event).receive('error', (e: any) => {
      t.is(e.toString(), 'no output_dataclip_id');
      done();
    });
  });
});
