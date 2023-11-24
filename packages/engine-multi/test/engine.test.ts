import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import createEngine from '../src/engine';
import * as e from '../src/events';
import { ExecutionPlan } from '@openfn/runtime';

// TOOD this becomes low level tests on the internal engine api

const logger = createMockLogger('', { level: 'debug' });

const options = {
  // This uses the mock worker, not the actual runtime
  // It will still exercise all the lifecycle logic found in the worker-helper,
  // Just not the runtime logic
  workerPath: path.resolve('dist/mock-worker.js'),
  logger,
  repoDir: '.', // doesn't matter for the mock
  noCompile: true, // messy - needed to allow an expression to be passed as json
  autoinstall: {
    handleIsInstalled: async () => true,
  },
  purge: true,
};

let engine;

test.afterEach(async () => {
  logger._reset();
  await engine?.destroy();
});

test.serial('create an engine', async (t) => {
  engine = await createEngine(options);
  t.truthy(engine);
  t.is(engine.constructor.name, 'Engine');
  t.truthy(engine.execute);
  t.truthy(engine.on);
  t.truthy(engine.once);
  t.truthy(engine.emit);
});

test.todo('throw if the worker is invalid');

test.serial('register a workflow', async (t) => {
  const plan = { id: 'z' };
  engine = await createEngine(options);

  const state = engine.registerWorkflow(plan);

  t.is(state.status, 'pending');
  t.is(state.id, plan.id);
  t.deepEqual(state.plan, plan);
});

test.serial('get workflow state', async (t) => {
  const plan = { id: 'z' } as ExecutionPlan;
  engine = await createEngine(options);

  const s = engine.registerWorkflow(plan);

  const state = engine.getWorkflowState(plan.id);

  t.deepEqual(state, s);
});

test.serial('use the default worker path', async (t) => {
  engine = await createEngine({ logger, repoDir: '.' });
  t.true(engine.workerPath.endsWith('worker/worker.js'));
});

test.serial('use a custom worker path', async (t) => {
  const workerPath = path.resolve('src/test/worker-functions.js');
  engine = await createEngine(options, workerPath);
  t.is(engine.workerPath, workerPath);
});

test.serial(
  'execute with test worker and trigger workflow-complete',
  async (t) => {
    return new Promise(async (done) => {
      const p = path.resolve('src/test/worker-functions.js');
      engine = await createEngine(options, p);

      const plan = {
        id: 'a',
        jobs: [
          {
            expression: '22',
          },
        ],
      };

      engine.execute(plan).on(e.WORKFLOW_COMPLETE, ({ state, threadId }) => {
        t.is(state, 22);
        t.truthy(threadId); // proves (sort of) that this has run in a worker

        // Apparently engine.destroy won't resolve if we return immediately
        setTimeout(done, 1);
      });
    });
  }
);

test.serial('execute does not return internal state stuff', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: '22',
        },
      ],
    };

    const result = engine.execute(plan, {});
    // Execute returns an event listener
    t.truthy(result.on);
    t.truthy(result.once);
    t.truthy(result.off);

    // ...but not en event emitter
    t.falsy(result['emit']);
    t.falsy(result['dispatch']);

    // and no other execution context
    t.falsy(result['state']);
    t.falsy(result['logger']);
    t.falsy(result['callWorker']);
    t.falsy(result['options']);

    done();
    // TODO is this still running? Does it matter?
  });
});

test.serial('listen to workflow-complete', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: '33',
        },
      ],
    };

    engine.listen(plan.id, {
      [e.WORKFLOW_COMPLETE]: ({ state, threadId }) => {
        t.is(state, 33);
        t.truthy(threadId); // proves (sort of) that this has run in a worker

        // Apparently engine.destroy won't resolve if we return immediately
        setTimeout(done, 1);
      },
    });
    engine.execute(plan);
  });
});

test.serial('call listen before execute', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: '34',
        },
      ],
    };

    engine.listen(plan.id, {
      [e.WORKFLOW_COMPLETE]: ({ state }) => {
        t.is(state, 34);

        // Apparently engine.destroy won't resolve if we return immediately
        setTimeout(done, 1);
      },
    });
    engine.execute(plan);
  });
});

test.serial('catch and emit errors', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: 'throw new Error("test")',
        },
      ],
    };

    engine.listen(plan.id, {
      [e.WORKFLOW_ERROR]: ({ message }) => {
        t.is(message, 'test');
        done();
      },
    });

    engine.execute(plan);
  });
});

test.serial('timeout the whole attempt and emit an error', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: 'while(true) {}',
        },
      ],
    };

    const opts = {
      timeout: 10,
    };

    engine.listen(plan.id, {
      [e.WORKFLOW_ERROR]: ({ message, type }) => {
        t.is(type, 'TimeoutError');
        t.regex(message, /failed to return within 10ms/);
        done();
      },
    });

    engine.execute(plan, opts);
  });
});

test.serial('Purge workers when a run is complete', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: '34',
        },
      ],
    };

    engine.on(e.PURGE, () => {
      t.pass('purge event called');
      done();
    });

    engine.execute(plan);
  });
});

test.serial('Purge workers when run errors', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: 'throw new Error("test")',
        },
      ],
    };

    engine.on(e.PURGE, () => {
      t.pass('purge event called');
      done();
    });

    engine.execute(plan);
  });
});

test.serial("Don't purge if purge is false", async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('src/test/worker-functions.js');
    engine = await createEngine(
      {
        ...options,
        purge: false,
      },
      p
    );

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: '34',
        },
      ],
    };

    engine.on(e.PURGE, () => {
      t.fail('purge event called');
      done();
    });

    engine.execute(plan).on(e.WORKFLOW_COMPLETE, () => {
      setTimeout(() => {
        t.pass('no purge called within 50ms');
        done();
      }, 50);
    });
  });
});

// I'm not actually going to use the destroy API (not for graceful shutdown anyway)
// So it doesn't feel too important to implement these tests
test.todo('destroy immediately, killing active workflows');
test.todo('destroy gracefully, allowing active workflows to complete');
