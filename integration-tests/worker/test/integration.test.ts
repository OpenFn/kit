import test from 'ava';
import path from 'node:path';
import crypto from 'node:crypto';
import Koa from 'koa';

import { initLightning, initWorker, randomPort } from '../src/init';

let lightning;
let worker;
let engine;
let engineLogger;
let lightningPort;

test.before(async () => {
  lightningPort = randomPort();
  lightning = initLightning(lightningPort);
  ({ worker, engine, engineLogger } = await initWorker(lightningPort, {
    maxWorkers: 1,
    purge: false,
    repoDir: path.resolve('tmp/repo/integration'),
  }));
});

test.afterEach(() => {
  engineLogger._reset();
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

test('should run a simple job with no compilation or adaptor', (t) => {
  return new Promise(async (done) => {
    lightning.once('attempt:complete', (evt) => {
      // This will fetch the final dataclip from the attempt
      const result = lightning.getResult('a1');
      t.deepEqual(result, { data: { answer: 42 } });

      t.pass('completed attempt');
      done();
    });

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
    let autoinstallEvent;

    lightning.once('attempt:complete', (evt) => {
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
  return new Promise(async (done) => {
    lightning.once('attempt:complete', () => {
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

test("Don't send job logs to stdout", (t) => {
  return new Promise(async (done) => {
    const attempt = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/language-common@latest',
          body: 'fn((s) =>  { console.log("@@@"); return s })',
        },
      ],
    };

    lightning.once('attempt:complete', () => {
      const jsonLogs = engineLogger._history.map((l) => JSON.parse(l));

      // The engine logger shouldn't print out any job logs
      const jobLog = jsonLogs.find((l) => l.name === 'JOB');
      t.falsy(jobLog);
      const jobLog2 = jsonLogs.find((l) => l.message[0] === '@@@');
      t.falsy(jobLog2);

      // But it SHOULD log engine stuff
      const runtimeLog = jsonLogs.find(
        (l) => l.name === 'R/T' && l.message[0].match(/completed job/i)
      );
      t.truthy(runtimeLog);
      done();
    });

    lightning.enqueueAttempt(attempt);
  });
});

test('run a job with initial state (with data)', (t) => {
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

    const initialState = { data: { name: 'Professor X' } };

    lightning.addDataclip('s1', initialState);

    lightning.once('attempt:complete', () => {
      const result = lightning.getResult(attempt.id);
      t.deepEqual(result, {
        ...initialState,
      });
      done();
    });

    // TODO: is there any way I can test the worker behaviour here?
    // I think I can listen to load-state right?
    // well, not really, not yet, not from the worker
    // see https://github.com/OpenFn/kit/issues/402

    lightning.enqueueAttempt(attempt);
  });
});

test('run a job with initial state (no top level keys)', (t) => {
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

    const initialState = { name: 'Professor X' };

    lightning.addDataclip('s1', initialState);

    lightning.once('attempt:complete', () => {
      const result = lightning.getResult(attempt.id);
      t.deepEqual(result, {
        ...initialState,
        data: {},
      });
      done();
    });

    // TODO: is there any way I can test the worker behaviour here?
    // I think I can listen to load-state right?
    // well, not really, not yet, not from the worker
    // see https://github.com/OpenFn/kit/issues/402

    lightning.enqueueAttempt(attempt);
  });
});

// TODO this sort of works but the server side of it does not
// Will work on it more
// TODO2: the runtime doesn't return config anymore (correctly!)
// So this test will fail. I need to get the server stuff working.
test.skip('run a job with credentials', (t) => {
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

    lightning.once('attempt:complete', (event) => {
      const { payload } = event;
      t.is(payload.reason, 'crash'); // TODO actually this should be a kill
      t.is(payload.error_message, 'module blacklisted: lodash');
      done();
    });

    lightning.enqueueAttempt(attempt);
  });
});

test('a timeout error should still call run-complete', (t) => {
  return new Promise(async (done) => {
    const attempt = {
      id: crypto.randomUUID(),
      jobs: [
        {
          // don't try to autoinstall an adaptor because it'll count in the timeout
          body: 'export default [(s) => new Promise((resolve) => setTimeout(() => resolve(s), 2000))]',
        },
      ],
      options: {
        runTimeout: 500,
      },
    };

    lightning.once('attempt:start', (event) => {
      t.log('attempt started');
    });

    lightning.once('run:complete', (event) => {
      t.is(event.payload.reason, 'kill');
      t.is(event.payload.error_type, 'TimeoutError');
    });

    lightning.once('attempt:complete', (event) => {
      done();
    });

    lightning.enqueueAttempt(attempt);
  });
});

test('an OOM error should still call run-complete', (t) => {
  return new Promise(async (done) => {
    const attempt = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/language-common@latest', // version lock to something stable?
          body: `
          fn((s) => {
              s.data = [];
              while(true) {
                s.data.push(new Array(1e5).fill("xyz"))
              }
              return s;
          })`,
        },
      ],
    };

    lightning.once('run:complete', (event) => {
      t.is(event.payload.reason, 'kill');
    });

    lightning.once('attempt:complete', (event) => {
      done();
    });

    lightning.enqueueAttempt(attempt);
  });
});

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

// TODO this test is a bit different now
// I think it's worth keeping
test('stateful adaptor should create a new client for each attempt', (t) => {
  return new Promise(async (done) => {
    // We want to create our own special worker here
    await worker.destroy();

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

    lightning.on('attempt:complete', (evt) => {
      const id = evt.attemptId;
      results[id] = lightning.getResult(id);

      if (id === attempt2.id) {
        const one = results[attempt1.id];
        const two = results[attempt2.id];

        // The two attempts should run in different threads
        t.not(one.threadId, two.threadId);
        t.not(one.clientId, two.clientId);

        done();
      }
    });

    const engineArgs = {
      repoDir: path.resolve('./dummy-repo'),
      maxWorkers: 1,
      purge: false,
    };
    await initWorker(lightningPort, engineArgs);

    lightning.enqueueAttempt(attempt1);
    lightning.enqueueAttempt(attempt2);
  });
});

// REMEMBER the default worker was destroyed at this point!
// If you want to use a worker, you'll have to create your own
