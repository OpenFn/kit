import test from 'ava';
import path from 'node:path';
import crypto from 'node:crypto';

import createLightningServer from '@openfn/lightning-mock';

import createEngine from '@openfn/engine-multi';
import createWorkerServer from '@openfn/ws-worker';

import { createMockLogger } from '@openfn/logger';

let lightning;
let worker;
let engine;

test.afterEach(async () => {
  lightning.destroy();
  await worker.destroy();
});

const initLightning = () => {
  // TODO the lightning mock right now doesn't use the secret
  // but we may want to add tests against this
  lightning = createLightningServer({ port: 8888 });
};

const initWorker = async (engineArgs = {}) => {
  engine = await createEngine({
    logger: createMockLogger('ENGINE', { level: 'debug' }),
    repoDir: path.resolve('./tmp/repo'),
    ...engineArgs,
  });

  worker = createWorkerServer(engine, {
    logger: createMockLogger('WORKER', { level: 'debug' }),
    port: 3333,
    lightning: 'ws://localhost:8888/worker',
    secret: crypto.randomUUID(),
  });
};

test('crash: syntax error', (t) => {
  return new Promise(async (done) => {
    const attempt = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/language-common@latest',
          body: 'fn(() => throw "e")',
        },
      ],
    };

    initLightning();

    lightning.on('attempt:complete', (evt) => {
      const { reason, error_type, error_message } = evt.payload;
      t.is(reason, 'crash');
      t.is(error_type, 'CompileError');
      t.regex(error_message, /Unexpected token \(1:9\)$/);
      done();
    });

    await initWorker();

    // TODO: is there any way I can test the worker behaviour here?
    // I think I can listen to load-state right?
    // well, not really, not yet, not from the worker
    // see https://github.com/OpenFn/kit/issues/402

    lightning.enqueueAttempt(attempt);
  });
});
