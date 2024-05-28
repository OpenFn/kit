import test from 'ava';
import path from 'node:path';
import crypto from 'node:crypto';
import Koa from 'koa';
import { generateKeys } from '@openfn/lightning-mock';

import { initLightning, initWorker, randomPort } from '../src/init';

let lightning;
let worker;
let engine;
let engineLogger;
let lightningPort;

test.before(async () => {
  const keys = await generateKeys();
  lightningPort = randomPort();
  lightning = initLightning(lightningPort, keys.private);

  const engineArgs = {
    maxWorkers: 1,
    repoDir: path.resolve('tmp/repo/integration'),
  };
  const workerArgs = { runPublicKey: keys.public };

  ({ worker, engine, engineLogger } = await initWorker(
    lightningPort,
    engineArgs,
    workerArgs
  ));
});

test.afterEach(() => {
  engineLogger._reset();
});

test.after(async () => {
  lightning.destroy();
  await worker.destroy();
});

const createDummyWorker = () => {
  const engineArgs = {
    repoDir: path.resolve('./dummy-repo'),
    maxWorkers: 1,
  };
  return initWorker(lightningPort, engineArgs);
};

test.serial('should run a simple job with no compilation or adaptor', (t) => {
  return new Promise(async (done) => {
    lightning.once('run:complete', (evt) => {
      // This will fetch the final dataclip from the attempt
      const result = lightning.getResult('a1');
      t.deepEqual(result, { data: { answer: 42 } });

      t.pass('completed attempt');
      done();
    });

    lightning.enqueueRun({
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

test.serial('run a job with autoinstall of common', (t) => {
  return new Promise(async (done) => {
    let autoinstallEvent;

    lightning.once('run:complete', (evt) => {
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

    lightning.enqueueRun({
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
test.serial('run a job which does NOT autoinstall common', (t) => {
  return new Promise(async (done) => {
    lightning.once('run:complete', () => {
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

    lightning.enqueueRun({
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

test.serial('run a job with initial state (with data)', (t) => {
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

    lightning.once('run:complete', (evt) => {
      t.log(evt.payload);
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

    lightning.enqueueRun(attempt);
  });
});

test.serial('run a job with initial state (no top level keys)', (t) => {
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

    lightning.once('run:complete', () => {
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

    lightning.enqueueRun(attempt);
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

    lightning.on('run:complete', () => {
      try {
        const result = lightning.getResult(attempt.id);
        t.deepEqual(result.configuration, config);

        server.close();
      } catch (e) {
        console.log(e);
      }
      done();
    });

    lightning.enqueueRun(attempt);
  });
});

test.serial('run a job with bad credentials', (t) => {
  return new Promise<void>(async (done) => {
    const attempt = {
      id: crypto.randomUUID(),
      dataclip_id: 's1',
      jobs: [
        {
          adaptor: '@openfn/language-common@latest',
          body: 'fn((s) => s)',
          credential: 'zzz',
        },
      ],
    };

    const initialState = { name: 'Professor X' };

    lightning.addDataclip('s1', initialState);

    lightning.once('run:complete', ({ payload }) => {
      t.is(payload.reason, 'exception');
      t.is(payload.error_type, 'CredentialLoadError');
      t.regex(
        payload.error_message,
        /Failed to load credential zzz: not_found/
      );
      done();
    });

    lightning.enqueueRun(attempt);
  });
});

test.serial('blacklist a non-openfn adaptor', (t) => {
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

    lightning.once('run:complete', (event) => {
      const { payload } = event;
      t.is(payload.reason, 'crash'); // TODO actually this should be a kill
      t.is(payload.error_message, 'module blacklisted: lodash');
      done();
    });

    lightning.enqueueRun(attempt);
  });
});

test.skip('a timeout error should still call step-complete', (t) => {
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
        runTimeoutMs: 500,
      },
    };

    lightning.once('run:start', () => {
      t.log('attempt started');
    });

    lightning.once('step:complete', (event) => {
      t.is(event.payload.reason, 'kill');
      t.is(event.payload.error_type, 'TimeoutError');
    });

    lightning.once('run:complete', () => {
      done();
    });

    lightning.enqueueRun(attempt);
  });
});

test.serial('an OOM error should still call step-complete', (t) => {
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

    lightning.once('step:complete', (event) => {
      t.is(event.payload.reason, 'kill');
    });

    lightning.once('run:complete', (event) => {
      done();
    });

    lightning.enqueueRun(attempt);
  });
});

// https://github.com/OpenFn/kit/pull/668
// This test relies on a capacity of 1
test.serial(
  'keep claiming work after a run with an uncaught exception',
  (t) => {
    return new Promise(async (done) => {
      const finished: Record<string, true> = {};

      const onComplete = (evt) => {
        const id = evt.runId;
        finished[id] = true;

        if (id === 'a20') {
          t.is(evt.payload.reason, 'crash');
        }
        if (id === 'a21') {
          t.is(evt.payload.reason, 'success');
        }

        if (finished.a20 && finished.a21) {
          t.pass('both runs completed');
          done();
        }
      };

      lightning.on('run:complete', onComplete);

      const body = `
fn(
  () => new Promise(() => {
    setTimeout(() => {
      throw new Error('uncaught')
    }, 1)
  })
)
`;

      lightning.enqueueRun({
        id: 'a20',
        jobs: [
          {
            id: 'j1',
            adaptor: '@openfn/language-common@latest',
            body,
          },
        ],
      });

      lightning.enqueueRun({
        id: 'a21',
        jobs: [
          {
            id: 'j2',
            adaptor: '@openfn/language-common@latest',
            body: 'fn(() => ({ data: { answer: 42} }))',
          },
        ],
      });
    });
  }
);

// https://github.com/OpenFn/kit/pull/668
// This test relies on a capacity of 1
test.serial('keep claiming work after a run with a process.exit', (t) => {
  return new Promise(async (done) => {
    const finished: Record<string, true> = {};

    const onComplete = (evt) => {
      const id = evt.runId;
      finished[id] = true;

      if (id === 'a30') {
        t.is(evt.payload.reason, 'crash');
      }
      if (id === 'a31') {
        t.is(evt.payload.reason, 'success');
      }

      if (finished.a30 && finished.a31) {
        t.pass('both runs completed');
        done();
      }
    };

    lightning.on('run:complete', onComplete);

    const body = `
fn(
  () => new Promise(() => {
    setTimeout(() => {
      process.exit()
    }, 1)
  })
)
`;

    lightning.enqueueRun({
      id: 'a30',
      jobs: [
        {
          id: 'j1',
          adaptor: '@openfn/language-common@latest',
          body,
        },
      ],
    });

    lightning.enqueueRun({
      id: 'a31',
      jobs: [
        {
          id: 'j2',
          adaptor: '@openfn/language-common@latest',
          body: 'fn(() => ({ data: { answer: 42} }))',
        },
      ],
    });
  });
});

test.serial("Don't send job logs to stdout", (t) => {
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

    lightning.once('run:complete', () => {
      const jsonLogs = engineLogger._history;
      // The engine logger shouldn't print out any job logs
      const jobLog = jsonLogs.find((l) => l.name === 'JOB');
      t.falsy(jobLog);
      const jobLog2 = jsonLogs.find((l) => l.message[0] === '@@@');
      t.falsy(jobLog2);

      // But it SHOULD log engine stuff
      const runtimeLog = jsonLogs.find(
        (l) => l.name === 'engine' && l.message[0].match(/complete workflow/i)
      );
      t.truthy(runtimeLog);
      done();
    });

    lightning.enqueueRun(attempt);
  });
});

test.serial("Don't send adaptor logs to stdout", (t) => {
  return new Promise(async (done) => {
    // We have to create a new worker with a different repo for this one
    await worker.destroy();
    ({ worker, engineLogger } = await createDummyWorker());

    const message = 've have been expecting you meester bond';
    const attempt = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/test-adaptor@1.0.0',
          body: `import { log } from '@openfn/test-adaptor'; log("${message}")`,
        },
      ],
    };

    lightning.once('run:complete', () => {
      const jsonLogs = engineLogger._history;
      // The engine logger shouldn't print out any adaptor logs
      const jobLog = jsonLogs.find((l) => l.name === 'ADA');
      t.falsy(jobLog);
      const jobLog2 = jsonLogs.find((l) => l.message[0] === message);
      t.falsy(jobLog2);

      // But it SHOULD log engine stuff
      const runtimeLog = jsonLogs.find(
        (l) => l.name === 'engine' && l.message[0].match(/complete workflow/i)
      );
      t.truthy(runtimeLog);
      done();
    });

    lightning.enqueueRun(attempt);
  });
});

test.serial(
  'stateful adaptor should create a new client for each attempt',
  (t) => {
    return new Promise(async (done) => {
      // We want to create our own special worker here
      await worker.destroy();
      ({ worker, engineLogger } = await createDummyWorker());

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

      lightning.on('run:complete', (evt) => {
        const id = evt.runId;
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

      lightning.enqueueRun(attempt1);
      lightning.enqueueRun(attempt2);
    });
  }
);

test.serial('worker should exit if it has an invalid key', (t) => {
  return new Promise(async (done) => {
    if (!worker.destroyed) {
      await worker.destroy();
    }

    // generate a new, invalid, public key
    const keys = await generateKeys();

    ({ worker } = await initWorker(
      lightningPort,
      {
        maxWorkers: 1,
        repoDir: path.resolve('tmp/repo/integration'),
      },
      {
        runPublicKey: keys.public,
      }
    ));

    const run = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/language-http@latest',
          body: `fn((s) => s`,
        },
      ],
    };

    // This should NOT run because the worker should
    // not verify the token and destroy itself
    lightning.once('run:start', () => {
      t.fail('invalid run was start');
      done();
    });
    lightning.once('run:complete', () => {
      t.fail('invalid run was completed');
      done();
    });

    // TODO this run will, at the moment, be LOST to Lightning
    lightning.enqueueRun(run);

    t.false(worker.destroyed);
    setTimeout(() => {
      // Ensure that the worker is destroyed after a brief interval
      t.true(worker.destroyed);
      done();
    }, 500);
  });
});

test.serial('set a default timeout on the worker', (t) => {
  return new Promise(async (done) => {
    if (!worker.destroyed) {
      await worker.destroy();
    }

    ({ worker } = await initWorker(lightningPort, {
      maxWorkers: 1,
      // use the dummy repo to remove autoinstall
      repoDir: path.resolve('./dummy-repo'),
      runTimeoutMs: 100,
    }));

    const run = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/test-adaptor@1.0.0',
          // this will never return
          body: `fn((s) => new Promise(resolve => {}))`,
        },
      ],
    };

    // let startTime;
    // lightning.once('run:start', (evt) => {
    //   startTime = Date.now();
    // });

    lightning.once('run:complete', (evt) => {
      const { reason, error_type, error_message } = evt.payload;
      t.is(reason, 'kill');
      t.is(error_type, 'TimeoutError');
      t.is(error_message, 'Workflow failed to return within 100ms');

      // TODO I'd like a better test on exactly how long the workflow ran before returnuing
      // But that's really hard because there's a lot of async stuff in the way

      // const endTime = Date.now();
      // t.true(endTime - startTime >= 40);
      // t.true(endTime - startTime <= 80); // be generous with this

      done();
    });

    lightning.enqueueRun(run);
  });
});

// create a new worker, set the timeout super high, run a job with a timeout on options, job should timeout
test.serial('set a timeout on a run', (t) => {
  return new Promise(async (done) => {
    if (!worker.destroyed) {
      await worker.destroy();
    }

    ({ worker } = await initWorker(lightningPort, {
      maxWorkers: 1,
      // use the dummy repo to remove autoinstall
      repoDir: path.resolve('./dummy-repo'),
      runTimeoutMs: 100 * 60 * 5,
    }));

    const run = {
      id: crypto.randomUUID(),
      jobs: [
        {
          adaptor: '@openfn/test-adaptor@1.0.0',
          // this will never return
          body: `fn((s) => new Promise(resolve => {}))`,
        },
      ],
      options: {
        run_timeout_ms: 100,
      },
    };

    lightning.once('run:complete', (evt) => {
      const { reason, error_type, error_message } = evt.payload;
      t.is(reason, 'kill');
      t.is(error_type, 'TimeoutError');
      t.is(error_message, 'Workflow failed to return within 100ms');

      done();
    });

    lightning.enqueueRun(run);
  });
});

// REMEMBER the default worker was destroyed at this point!
// If you want to use a worker, you'll have to create your own
