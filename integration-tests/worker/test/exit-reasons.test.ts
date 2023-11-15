import test from 'ava';
import crypto from 'node:crypto';
import path from 'node:path';

import { initLightning, initWorker } from '../src/init';

let lightning;
let worker;

test.before(async () => {
  const lightningPort = 4321;

  lightning = initLightning(lightningPort);

  ({ worker } = await initWorker(lightningPort, {
    repoDir: path.resolve('tmp/repo/exit-reason'),
  }));
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

const run = async (attempt) => {
  return new Promise<any>(async (done) => {
    lightning.once('attempt:complete', (evt) => {
      if (attempt.id === evt.attemptId) {
        done(evt.payload);
      }
    });

    lightning.enqueueAttempt(attempt);
  });
};

test('crash: syntax error', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: 'fn(() => throw "e")',
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;

  t.is(reason, 'crash');
  t.is(error_type, 'CompileError');
  t.regex(error_message, /Unexpected token \(1:9\)$/);
});
