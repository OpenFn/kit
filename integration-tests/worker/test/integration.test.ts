import test from 'ava';

import createLightningServer from '@openfn/lightning-mock';

import createEngine from '@openfn/engine-multi';
import createWorkerServer from '@openfn/ws-worker';

import createLogger, { createMockLogger } from '@openfn/logger';

let lightning;
let worker;

test.afterEach(() => {
  lightning.destroy();
  worker.destroy();
});

const initLightning = () => {
  lightning = createLightningServer({ port: 9999 });
};

const initWorker = () => {
  const engine = createEngine({
    // logger: createLogger('engine', { level: 'debug' }),
    logger: createMockLogger(),
    runtimeLogger: createMockLogger(),
  });

  worker = createWorkerServer(engine, {
    logger: createMockLogger(),
    // logger: createLogger('worker', { level: 'debug' }),
    port: 2222,
    lightning: 'ws://localhost:9999/worker',
    secret: 'abc', // TODO use a more realistic secret
  });
};

test('should connect to lightning', (t) => {
  return new Promise((done) => {
    initLightning();
    lightning.on('socket:connect', () => {
      t.pass('connection recieved');
      done();
    });
    initWorker();
  });
});

test('should join attempts queue channel', (t) => {
  return new Promise((done) => {
    initLightning();
    lightning.on('socket:channel-join', ({ channel }) => {
      if (channel === 'worker:queue') {
        t.pass('joined channel');
        done();
      }
    });
    initWorker();
  });
});

test.only('should run a simple job with no compilation', (t) => {
  return new Promise((done) => {
    initLightning();
    lightning.on('attempt:complete', (evt) => {
      t.pass('completed attempt');
      done();
    });
    initWorker();

    lightning.enqueueAttempt({
      id: 'a1',
      jobs: [
        {
          id: 'j1',
          body: 'const fn = (f) => (state) => f(state); fn(() => ({ data: { answer: 42} }))',
        },
      ],
    });
  });
});
