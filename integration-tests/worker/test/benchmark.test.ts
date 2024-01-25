import test from 'ava';
import path from 'node:path';

import { createAttempt } from '../src/factories';
import { initLightning, initWorker } from '../src/init';
import { run, humanMb } from '../src/util';

let lightning;
let worker;

const maxConcurrency = 20;

test.before(async () => {
  const lightningPort = 4322;

  lightning = initLightning(lightningPort);

  ({ worker } = await initWorker(
    lightningPort,
    {
      repoDir: path.resolve('tmp/repo/bench'),
      maxWorkers: maxConcurrency,
    },
    {
      // Keep the backoff nice and low so that we can claim attempts quickly
      backoff: { min: 0.001, max: 0.1 },
      maxWorkflows: maxConcurrency,
    }
  ));

  // trigger autoinstall
  const bootstrap = createAttempt(
    [],
    [
      {
        body: 'fn((s) => s)',
        adaptor: '@openfn/language-common@1.7.0',
      },
    ],
    []
  );

  await run(lightning, bootstrap);
});

test.afterEach(async () => {
  lightning.reset();
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

// Skipping these in CI (for now at least)
test.serial('run 100 attempts', async (t) => {
  return new Promise((done, reject) => {
    const attemptsTotal = 100;
    let attemptsComplete = 0;

    let jobMax = 0;
    let sysMax = 0;

    const start = Date.now();

    for (let i = 0; i < attemptsTotal; i++) {
      const attempt = createAttempt(
        [],
        [
          {
            body: `fn((s) => new Promise(resolve => {
                // create an array and fill with random items
                const items = []
                while (items.length > 1e6) {
                  items.push(Math.randomInt * 1000)
                }
                // sort it and stringify
                s.data = items.sort().join('-')

                // wait before returning
                setTimeout(() => resolve(s), 100)
              }))`,
            adaptor: '@openfn/language-common@1.7.0',
          },
        ],
        []
      );
      lightning.enqueueAttempt(attempt);
    }

    lightning.on('run:complete', (evt) => {
      // May want to disable this  but it's nice feedback
      t.log('Completed ', evt.attemptId);

      if (evt.payload.reason !== 'success') {
        t.log('Atempt failed:');
        t.log(evt.payload);
        reject('Attempt failed!');
      }

      attemptsComplete++;

      const { job, system } = evt.payload.mem;
      jobMax = Math.max(job, jobMax);
      sysMax = Math.max(system, sysMax);

      if (attemptsComplete === attemptsTotal) {
        t.log(`${attemptsComplete} attempts processed`);
        t.log(`${maxConcurrency} concurrent workers`);
        t.log(`duration: ${(Date.now() - start) / 1000}s`);
        t.log(`max job memory: ${humanMb(jobMax)}mb`);
        t.log(`max system memory: ${humanMb(sysMax)}mb`);
        t.pass('done');
        done();
      }
    });
  });
});
