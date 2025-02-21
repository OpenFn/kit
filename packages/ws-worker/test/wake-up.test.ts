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
const getRun = (): LightningPlan =>
  ({
    id: `a${++rollingRunId}`,
    jobs: [
      {
        body: 'fn(s => s)',
      },
    ],
  } as LightningPlan);

test.before(async () => {
  engine = await createMockRTE();
  lng = createLightningServer({
    port: 7654,
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
      t.fail('expected claim received');
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
