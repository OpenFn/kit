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

test('exception: autoinstall error', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-worker-integration-tests@9.9.9',
        body: 'fn((s) => s)',
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;

  t.is(reason, 'exception');
  t.is(error_type, 'AutoinstallError');
  t.regex(
    error_message,
    /Error installing @openfn\/language-worker-integration-tests@9.9.9/
  );
});

test('kill: oom (small, kill worker)', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: `fn((s) => {
          s.data = [];
          while(true) {
            s.data.push(new Array(1e6).fill("xyz"))
          }
        })`,
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'kill');
  t.is(error_type, 'OOMError');
  t.is(error_message, 'Run exceeded maximum memory usage');
});

test('kill: oom (large, kill vm)', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-common@latest',
        body: `fn((s) => {
          s.data = [];
          while(true) {
            s.data.push(new Array(1e9).fill("xyz"))
          }
        })`,
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;
  t.is(reason, 'kill');
  t.is(error_type, 'OOMError');
  t.is(error_message, 'Run exceeded maximum memory usage');
});

test('crash: process.exit() triggered by postgres', async (t) => {
  const attempt = {
    id: crypto.randomUUID(),
    jobs: [
      {
        adaptor: '@openfn/language-postgresql@4.1.8', // version number is important
        body: "sql('select * from food_hygiene_interview');",
      },
    ],
  };

  const result = await run(attempt);

  const { reason, error_type, error_message } = result;

  t.is(reason, 'crash');
  t.is(error_type, 'ExitError');
  t.regex(error_message, /Process exited with code: 1/i);
});
