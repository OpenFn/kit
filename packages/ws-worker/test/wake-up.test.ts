/*
 * Tests manual claim from lightning when it hits /run?wakeup=true
 */

import test from 'ava';
import createLightningServer from '@openfn/lightning-mock';

import createMockRTE from '../src/mock/runtime-engine';
import createWorkerServer from '../src/server';
import * as e from '../src/events';

import type { LightningPlan } from '@openfn/lexicon/lightning';

let lng: ReturnType<typeof createLightningServer>;
let engine: Awaited<ReturnType<typeof createMockRTE>>;

const urls = {
  worker: 'http://localhost:4567',
  lng: 'ws://localhost:7654/worker',
  lngServer: 'http://localhost:7654',
};

const ONE_HOUR = 1000 * 60 * 60;

let rollingRunId = 1;

const getRun = (body = 'fn(s => s)'): LightningPlan =>
  ({
    id: `a${++rollingRunId}`,
    jobs: [
      {
        body,
      },
    ],
  } as LightningPlan);

test.before(async () => {
  engine = await createMockRTE();
  lng = createLightningServer({
    port: 7654,
    socketDelay: 10,
  });

  createWorkerServer(engine, {
    port: 4567,
    lightning: urls.lng,
    maxWorkflows: 1,
    backoff: {
      min: ONE_HOUR,
      max: ONE_HOUR * 2,
    },
  });

  // workers make an initial claim on start.
  // wait for that claim before running the below tests.
  await new Promise((done) => {
    lng.on(e.CLAIM, done);
  });
});

const test_timeout = 150;

// control test!
test('should not initiate a quick claim', async (t) => {
  t.plan(1);
  t.timeout(test_timeout);
  return new Promise<void>(async (done) => {
    // timeout to be sure no claim happened
    setTimeout(() => {
      t.pass();
      done();
    }, test_timeout - 65);

    const run = getRun();
    lng.onSocketEvent(e.CLAIM, run.id, () => {
      t.fail('unexpected claim received');
      done();
    });

    await fetch(`${urls.lngServer}/run`, {
      method: 'POST',
      body: JSON.stringify(run),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });
});

// main test
test('should initiate a claim when /run?wakeup=true', async (t) => {
  t.plan(1);
  return new Promise<void>(async (done) => {
    const run = getRun();
    lng.onSocketEvent(e.CLAIM, run.id, () => {
      t.pass('claim happened on lightning');
      done();
    });

    await fetch(`${urls.lngServer}/run?wakeup=true`, {
      method: 'POST',
      body: JSON.stringify(run),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });
});

// This tests creates two runs, call wake_up on them both,
// and ensures they are executed sequentially
// This doesn't feel like a great test, but if the pending claims validation
// is removed from claim.ts, it fails. So it is kinda working
test.only('should not claim beyond capacity', async (t) => {
  t.plan(2);
  let claimCount = 0;
  return new Promise<void>(async (done) => {
    const run_1 = getRun(
      's => new Promise(resolve => setTimeout(resolve, 200))'
    );
    const run_2 = getRun(
      's => new Promise(resolve => setTimeout(resolve, 200))'
    );
    let run_1_finished = false;

    lng.onSocketEvent(e.RUN_COMPLETE, run_1.id, (evt) => {
      if (evt.runId === run_1.id) {
        t.log(' RUN 1 complete');
        run_1_finished = true;
      }
    });

    lng.onSocketEvent(e.RUN_START, run_2.id, (evt) => {
      if (evt.runId === run_2.id) {
        t.log(' RUN 2 start');
        // Ensure that run 1 is finished when run 2 starts
        t.true(run_1_finished);
      }
    });

    // TODO there's a terrible bug in the mock and these events don't bind right
    lng.onSocketEvent(e.RUN_COMPLETE, run_2.id, (evt) => {
      if (evt.runId === run_2.id) {
        t.log(' RUN 2 complete');
        // Only 2 claims should be made
        t.is(claimCount, 2);
        done();
      }
    });

    lng.onSocketEvent(e.CLAIM, run_1.id, () => {
      claimCount++;
    });

    // Send two runs up at the same time
    fetch(`${urls.lngServer}/run?wakeup=true`, {
      method: 'POST',
      body: JSON.stringify(run_1),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    fetch(`${urls.lngServer}/run?wakeup=true`, {
      method: 'POST',
      body: JSON.stringify(run_2),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });
});
