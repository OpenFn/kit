import test from 'ava';
import path from 'node:path';

import createLightningServer from '@openfn/lightning-mock';

import createEngine from '@openfn/engine-multi';
import createWorkerServer from '@openfn/ws-worker';

import createLogger, { createMockLogger } from '@openfn/logger';

let lightning;
let worker;
let engine;

test.afterEach(() => {
  lightning.destroy();
  worker.destroy();
});

const initLightning = () => {
  lightning = createLightningServer({ port: 9999 });
};

const initWorker = () => {
  engine = createEngine({
    // logger: createLogger('engine', { level: 'debug' }),
    logger: createMockLogger(),
    runtimeLogger: createMockLogger(),
    repoDir: path.resolve('./tmp/repo'),
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
      // the complete payload should have a final dataclip id
      // we should also be able to ask lightning for the result
      // const { payload: state } = evt;
      // console.log(evt);
      // t.deepEqual(state, { data: { answer: 42 } });
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

// todo ensure repo is clean
// check how we manage the env in cli tests
test('run a job with autoinstall of common', (t) => {
  return new Promise((done) => {
    initLightning();

    let autoinstallEvent;

    lightning.on('attempt:complete', (evt) => {
      try {
        t.truthy(autoinstallEvent);
        t.is(autoinstallEvent.module, '@openfn/language-common');
        t.is(autoinstallEvent.version, 'latest');
        t.assert(autoinstallEvent.duration >= 100);

        const { result } = evt;
        t.deepEqual(result, { data: { answer: 42 } });
        done();
      } catch (e) {
        t.fail(e);
        done();
      }
    });

    initWorker();

    // listen to events for this attempt
    engine.listen('a1', {
      'autoinstall-complete': (evt) => {
        autoinstallEvent = evt;
      },
    });

    lightning.enqueueAttempt({
      id: 'a1',
      jobs: [
        {
          id: 'j1',
          adaptor: '@openfn/language-common@latest', // version lock to something stable?
          body: 'fn(() => ({ data: { answer: 42} }))',
        },
      ],
    });
  });
});

// this depends on prior test!
test.todo("run a job which doesn't autoinstall common");
test.todo('run a job with complex behaviours (initial state, branching)');

// maybe create a http server with basic auth on the endpoint
// use http adaptor to call the server
// obviously credential is lazy loaded
test.todo('run a job which requires credentials');
