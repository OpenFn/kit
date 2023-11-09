import test from 'ava';
import path from 'node:path';
import crypto from 'node:crypto';
import Koa from 'koa';

import createLightningServer from '@openfn/lightning-mock';

import createEngine from '@openfn/engine-multi';
import createWorkerServer from '@openfn/ws-worker';

import createLogger, { createMockLogger } from '@openfn/logger';

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
  lightning = createLightningServer({ port: 9999 });
};

const initWorker = async (engineArgs = {}) => {
  engine = await createEngine({
    // logger: createLogger('engine', { level: 'debug' }),
    logger: createMockLogger(),
    repoDir: path.resolve('./tmp/repo'),
    ...engineArgs,
  });

  worker = createWorkerServer(engine, {
    logger: createMockLogger(),
    // logger: createLogger('worker', { level: 'debug' }),
    port: 2222,
    lightning: 'ws://localhost:9999/worker',
    secret: crypto.randomUUID(),
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

test('should run a simple job with no compilation or adaptor', (t) => {
  return new Promise(async (done) => {
    initLightning();

    lightning.on('attempt:complete', (evt) => {
      // This will fetch the final dataclip from the attempt
      const result = lightning.getResult('a1');
      t.deepEqual(result, { data: { answer: 42 } });

      t.pass('completed attempt');
      done();
    });

    await initWorker();

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

test('run a job with autoinstall of common', (t) => {
  return new Promise(async (done) => {
    initLightning();

    let autoinstallEvent;

    lightning.on('attempt:complete', (evt) => {
      try {
        t.truthy(autoinstallEvent);
        t.is(autoinstallEvent.module, '@openfn/language-common');
        t.is(autoinstallEvent.version, 'latest');
        // Expect autoinstall to take several seconds
        t.assert(autoinstallEvent.duration >= 1000);

        // This will fetch the final dataclip from the attempt
        const result = lightning.getResult('a33');
        t.deepEqual(result, { data: { answer: 42 } });

        done();
      } catch (e) {
        t.fail(e);
        done();
      }
    });

    await initWorker();

    // listen to events for this attempt
    engine.listen('a33', {
      'autoinstall-complete': (evt) => {
        autoinstallEvent = evt;
      },
    });

    lightning.enqueueAttempt({
      id: 'a33',
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
test('run a job which does NOT autoinstall common', (t) => {
  return new Promise(async (done, _fail) => {
    initLightning();

    lightning.on('attempt:complete', (evt) => {
      try {
        // This will fetch the final dataclip from the attempt
        const result = lightning.getResult('a10');
        t.deepEqual(result, { data: { answer: 42 } });

        done();
      } catch (e) {
        t.fail(e);
        done();
      }
    });

    await initWorker();

    // listen to events for this attempt
    engine.listen('a10', {
      'autoinstall-complete': (evt) => {
        // TODO: I think soon I'm going to issue a compelte event even if
        // it loads from cache, so this will need changing
        t.fail('Unexpeted autoinstall event!');
      },
    });

    lightning.enqueueAttempt({
      id: 'a10',
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

test('run a job with initial state', (t) => {
  return new Promise(async (done) => {
    const attempt = {
      id: crypto.randomUUID(),
      dataclip_id: 's1',
      jobs: [
        {
          adaptor: '@openfn/language-common@latest',
          body: 'fn((s) => s)',
        },
      ],
    };

    initLightning();

    const initialState = { data: { name: 'Professor X' } };

    lightning.addDataclip('s1', initialState);

    lightning.on('attempt:complete', () => {
      const result = lightning.getResult(attempt.id);
      t.deepEqual(result, {
        ...initialState,
        configuration: {},
      });
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

// TODO this sort of works but the server side of it does not
// Will work on it more
test('run a job with credentials', (t) => {
  // Set up a little web server to receive a request
  // (there are easier ways to do this, but this is an INTEGRATION test right??)
  const PORT = 4826;
  const createServer = () => {
    const app = new Koa();

    app.use(async (ctx, next) => {
      console.log('GET!');
      // TODO check basic credential
      ctx.body = '{ message: "ok" }';
      ctx.response.headers['Content-Type'] = 'application/json';
      ctx.response.status = 200;
    });

    return app.listen(PORT);
  };

  return new Promise<void>(async (done) => {
    const server = createServer();
    const config = {
      username: 'logan',
      password: 'jeangr3y',
    };

    const attempt = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/language-http@latest',
          body: `fn((s) => {
            console.log(s);
            return s
          })`,
          // body: `get("http://localhost:${PORT}")
          // fn((s) => {
          //   console.log(s);
          //   return s;
          // })`,
          credential: 'c',
        },
      ],
    };

    initLightning();

    lightning.addCredential('c', config);

    lightning.on('attempt:complete', () => {
      try {
        const result = lightning.getResult(attempt.id);
        t.deepEqual(result.configuration, config);

        server.close();
      } catch (e) {
        console.log(e);
      }
      done();
    });

    await initWorker();
    lightning.enqueueAttempt(attempt);
  });
});

test('blacklist a non-openfn adaptor', (t) => {
  return new Promise(async (done) => {
    const attempt = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: 'lodash@latest',
          body: 'import _ from "lodash"',
        },
      ],
    };

    initLightning();

    // At the moment the error comes back to on complete
    lightning.on('attempt:complete', (event) => {
      const { payload } = event;
      t.is(payload.reason, 'crash'); // TODO actually this should be a kill
      t.is(payload.error_message, 'module blacklisted: lodash');
      done();
    });

    await initWorker();

    lightning.enqueueAttempt(attempt);
  });
});

test.todo('return some kind of error on compilation error');

// test('run a job with complex behaviours (initial state, branching)', (t) => {
//   const attempt = {
//     id: 'a1',
//     initialState: 's1
//     jobs: [
//       {
//         id: 'j1',
//         body: 'const fn = (f) => (state) => f(state); fn(() => ({ data: { answer: 42} }))',
//       },
//     ],
//   }

//   initLightning();
//   lightning.on('attempt:complete', (evt) => {
//     // This will fetch the final dataclip from the attempt
//     const result = lightning.getResult('a1');
//     t.deepEqual(result, { data: { answer: 42 } });

//     t.pass('completed attempt');
//     done();
//   });
//   initWorker();

//   lightning.enqueueAttempt({
//     id: 'a1',
//     jobs: [
//       {
//         id: 'j1',
//         body: 'const fn = (f) => (state) => f(state); fn(() => ({ data: { answer: 42} }))',
//       },
//     ],
//   });
// });
// });

test('stateful adaptor should create a new client for each attempt', (t) => {
  return new Promise(async (done) => {
    const engineArgs = {
      repoDir: path.resolve('./dummy-repo'),
      maxWorkers: 1,
      purge: false,
    };

    const attempt1 = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/stateful-test@1.0.0',
          // manual import shouldn't be needed but its not important enough to fight over
          body: `import { fn, threadId, clientId } from '@openfn/stateful-test';
          fn(() => {
            return { threadId, clientId }
          })`,
        },
      ],
    };
    const attempt2 = {
      ...attempt1,
      id: crypto.randomUUID(),
    };
    let results = {};

    initLightning();
    lightning.on('attempt:complete', (evt) => {
      const id = evt.attemptId;
      results[id] = lightning.getResult(id);

      if (id === attempt2.id) {
        const one = results[attempt1.id];
        const two = results[attempt2.id];
        // The module should be isolated within the same thread
        t.is(one.threadId, two.threadId);

        t.not(one.clientId, two.clientId);
        done();
      }
    });

    // Note that this API doesn't work!!
    // shaeme, it would be useful
    // lightning.waitForResult(attempt.id, (result) => {
    //   console.log(result)
    //   t.pass()
    //   done()
    // })

    await initWorker(engineArgs);

    lightning.enqueueAttempt(attempt1);
    lightning.enqueueAttempt(attempt2);
  });
});
