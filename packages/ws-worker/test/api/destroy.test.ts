import test from 'ava';
import crypto from 'node:crypto';
import createLightningServer from '@openfn/lightning-mock';
import { createMockLogger } from '@openfn/logger';
import { Run } from '@openfn/lexicon/lightning';

import createWorker from '../../src/server';
import createMockRTE from '../../src/mock/runtime-engine';
import destroy from '../../src/api/destroy';

const workerPort = 9876;
const lightningPort = workerPort + 1;

const logger = createMockLogger();
const lightning = createLightningServer({ port: lightningPort });

let worker: any;

test.beforeEach(async () => {
  const engine: any = await createMockRTE();

  worker = createWorker(engine, {
    logger,
    lightning: `ws://localhost:${lightningPort}/worker`,
    port: workerPort,
    backoff: { min: 10, max: 20 },
  });
});

test.afterEach(() => {
  lightning.reset();
});

const createRun = () =>
  ({
    id: crypto.randomUUID(),
    jobs: [
      {
        id: crypto.randomUUID(),
        body: `wait(${500 + Math.random() * 1000})`,
      },
    ],
  } as Run);

const waitForClaim = (timeout: number = 1000) =>
  new Promise<boolean>((resolve) => {
    const handler = () => {
      if (!didTimeout) {
        resolve(true);
      }
    };
    let didTimeout = false;

    setTimeout(() => {
      didTimeout = true;
      lightning.off('claim', handler);
      resolve(false);
    }, timeout);

    lightning.once('claim', handler);
  });

const ping = async () => {
  let status;
  try {
    const response = await fetch(`http://localhost:${workerPort}/`);
    status = response.status;
  } catch (e) {}

  return status === 200;
};

test.serial('destroy a worker with no active runs', async (t) => {
  // should respond to get
  t.true(await ping());
  // should be claiming
  t.true(await waitForClaim());

  await destroy(worker, logger);

  // should not respond to get
  t.false(await ping());
  // should not be claiming
  t.false(await waitForClaim());

  // TODO how can I test the socket is closed?
});

// WARNING this might be flaky in CI
test.serial('destroy a worker while one run is active', async (t) => {
  return new Promise((done) => {
    let didFinish = false;

    const doDestroy = async () => {
      await destroy(worker, logger);

      t.true(didFinish);

      // should not respond to get
      t.false(await ping());
      // should not be claiming
      t.false(await waitForClaim());

      done();
    };

    lightning.once('claim', () => {
      // The run should be active immediately after it's claimed
      // BUT in these tests we do need a moment's grace - this event occurs
      // at the lightning end and the handler in the worker may not have executed yet
      setTimeout(() => {
        doDestroy();
      }, 2);
    });

    lightning.once('run:complete', () => {
      didFinish = true;
    });
    lightning.enqueueRun(createRun());
  });
});

test.serial('destroy a worker while multiple runs are active', async (t) => {
  return new Promise((done) => {
    let completeCount = 0;
    let startCount = 0;

    const doDestroy = async () => {
      await destroy(worker, logger);

      // Ensure all three runs completed
      t.is(completeCount, 3);

      // should not respond to get
      t.false(await ping());
      // should not be claiming
      t.false(await waitForClaim());

      done();
    };

    lightning.on('run:start', () => {
      startCount++;

      // Let all three workflows start before we kill the server
      if (startCount === 3) {
        doDestroy();
      }
    });

    lightning.on('run:complete', () => {
      completeCount++;
    });

    lightning.enqueueRun(createRun());
    lightning.enqueueRun(createRun());
    lightning.enqueueRun(createRun());
  });
});

test("don't claim after destroy", (t) => {
  return new Promise((done) => {
    let completeCount = 0;

    const doDestroy = async () => {
      await destroy(worker, logger);

      t.is(completeCount, 1);
      t.is(lightning.getQueueLength(), 1);
      done();
    };

    // Destroy the server immediately after the first claim
    // again, we leave a slight grace period
    lightning.once('claim', () => {
      setTimeout(() => {
        doDestroy();
      }, 2);
    });

    lightning.on('run:complete', () => {
      completeCount++;
    });

    // Add two things to the queue
    lightning.enqueueRun(createRun());

    // This second one should never be claimed
    lightning.enqueueRun(createRun());
  });
});
