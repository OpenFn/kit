import test from 'ava';
import crypto from 'node:crypto';
import createLightningServer, {
  generateKeys,
  toBase64,
} from '@openfn/lightning-mock';
import { createMockLogger } from '@openfn/logger';
import { LightningPlan } from '@openfn/lexicon/lightning';

import createWorker from '../../src/server';
import createMockRTE from '../../src/mock/runtime-engine';
import destroy from '../../src/api/destroy';
import {
  INTERNAL_CLAIM_COMPLETE,
  INTERNAL_CLAIM_START,
  INTERNAL_SOCKET_READY,
} from '../../src';

const workerPort = 9876;
const lightningPort = workerPort + 1;

const logger = createMockLogger();
let lightning: any;
let worker: any;
let keys = { private: '.', public: '.' };

const initLightning = (options = {}) => {
  lightning = createLightningServer({ port: lightningPort, ...options });
};

const initWorker = (options = {}) => {
  return new Promise<void>(async (resolve) => {
    const engine: any = await createMockRTE();

    worker = createWorker(engine, {
      logger,
      lightning: `ws://localhost:${lightningPort}/worker`,
      port: workerPort,
      backoff: { min: 10, max: 20 },
      collectionsVersion: '1.0.0',
      ...options,
    });
    worker.events.on(INTERNAL_SOCKET_READY, () => {
      resolve();
    });
  });
};

test.before(async () => {
  keys = await generateKeys();
});

test.afterEach(async () => {
  await lightning.destroy();
  logger._reset();
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
  } as LightningPlan);

const waitForClaim = (timeout: number = 1000) =>
  new Promise<boolean>((resolve) => {
    let didTimeout = false;
    let didResolve = false;
    const handler = () => {
      didResolve = true;
      lightning.off('claim', handler);
      if (!didTimeout) {
        resolve(true);
      }
    };

    setTimeout(() => {
      if (!didResolve) {
        didTimeout = true;
        lightning.off('claim', handler);
        resolve(false);
      }
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
  initLightning();
  await initWorker();

  // should respond to get
  t.true(await ping());
  // should be claiming
  t.true(await waitForClaim());

  await destroy(worker, logger);

  // should not respond to get
  t.false(await ping());
  // should not be claiming
  t.false(await waitForClaim());
});

test.serial('destroy a worker while one run is active', async (t) => {
  initLightning();
  await initWorker();

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

    lightning.once('run:complete', () => {
      didFinish = true;
    });

    lightning.once('claim', () => {
      // The run should be active immediately after it's claimed
      // BUT in these tests we do need a moment's grace - this event occurs
      // at the lightning end and the handler in the worker may not have executed yet
      setTimeout(() => {
        doDestroy();
      }, 5);
    });
    lightning.enqueueRun(createRun());
  });
});

test.serial('destroy a worker while multiple runs are active', async (t) => {
  initLightning();
  await initWorker();

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

test.serial(
  'destroy a worker while a claim is outstanding and wait for the run to complete',
  async (t) => {
    t.plan(4);
    initLightning({
      socketDelay: 50,
    });
    await initWorker({ noLoop: true });
    return new Promise((done) => {
      let didFinish = false;

      const doDestroy = async () => {
        await destroy(worker, logger);

        t.true(didFinish, 'Run did not finish');

        // should not respond to get
        t.false(await ping());
        // should not be claiming
        t.false(await waitForClaim());

        done();
      };
      // As soon as the claim starts, kill the worker
      worker.events.once(INTERNAL_CLAIM_START, () => {
        doDestroy();
      });

      // We still expect the run to complete
      lightning.once('run:complete', () => {
        didFinish = true;
      });

      // By the time the claim is complete, the worker should be marked destroyed
      worker.events.once(INTERNAL_CLAIM_COMPLETE, () => {
        t.true(worker.destroyed);
      });

      lightning.enqueueRun(createRun());
      worker.claim().catch();
    });
  }
);

// The async bit is important because we can actually lose a run between claim and start
test.serial(
  'destroy a worker while a claim is outstanding and wait for the run to complete with async token validation',
  async (t) => {
    t.plan(4);

    initLightning({
      socketDelay: 50,
      runPrivateKey: toBase64(keys.private),
    });
    await initWorker({ noLoop: true, runPublicKey: keys.public });

    return new Promise((done) => {
      let didFinish = false;

      const doDestroy = async () => {
        await destroy(worker, logger);

        t.true(didFinish, 'Run did not finish');

        // should not respond to get
        t.false(await ping());
        // should not be claiming
        t.false(await waitForClaim());

        done();
      };

      // As soon as the claim starts, kill the worker
      worker.events.once(INTERNAL_CLAIM_START, () => {
        doDestroy();
      });

      // We still expect the run to complete
      lightning.once('run:complete', () => {
        didFinish = true;
      });

      // By the time the claim is complete, the worker should be marked destroyed
      worker.events.once(INTERNAL_CLAIM_COMPLETE, () => {
        t.true(worker.destroyed);
      });

      lightning.enqueueRun(createRun());
      worker.claim().catch();
    });
  }
);

test("don't claim after destroy", async (t) => {
  initLightning();
  await initWorker();

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
      }, 5);
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
