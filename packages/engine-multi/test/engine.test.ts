import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/lexicon';

import createEngine, { InternalEngine } from '../src/engine';
import * as e from '../src/events';
import type { ExecuteOptions } from '../src/types';

const logger = createMockLogger('', { level: 'debug' });

const options = {
  // This uses the mock worker, not the actual runtime
  // It will still exercise all the lifecycle logic found in the worker-helper,
  // Just not the runtime logic
  workerPath: path.resolve('dist/test/mock-run.js'),
  logger,
  repoDir: '.', // doesn't matter for the mock
  noCompile: true, // messy - needed to allow an expression to be passed as json
  autoinstall: {
    handleIsInstalled: async () => true,
  },
};

const createPlan = (expression: string = '.', id = 'a') => ({
  id,
  workflow: {
    steps: [
      {
        expression,
        adaptors: [],
      },
    ],
  },
  options: {},
});

let engine: InternalEngine;

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
  t.true(engine.workerPath.endsWith('worker/thread/run.js'));
});

test.serial('use a custom worker path', async (t) => {
  const workerPath = path.resolve('dist/test/worker-functions.js');
  engine = await createEngine(options, workerPath);
  t.is(engine.workerPath, workerPath);
});

test.serial(
  'execute with test worker and trigger workflow-complete',
  async (t) => {
    return new Promise(async (done) => {
      const p = path.resolve('dist/test/worker-functions.js');
      engine = await createEngine(options, p);

      const plan = createPlan('22');

      engine
        .execute(plan, {})
        .on(e.WORKFLOW_COMPLETE, ({ state, threadId }) => {
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
    const p = path.resolve('dist/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = createPlan();

    const result: any = engine.execute(plan, {});
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
  });
});

test.serial('listen to workflow-complete', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('dist/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = createPlan('33');

    engine.listen(plan.id, {
      [e.WORKFLOW_COMPLETE]: ({
        state,
        threadId,
      }: e.WorkflowCompletePayload) => {
        t.is(state, 33);
        t.truthy(threadId); // proves (sort of) that this has run in a worker

        // Apparently engine.destroy won't resolve if we return immediately
        setTimeout(done, 1);
      },
    });
    engine.execute(plan, {});
  });
});

test.serial('call listen before execute', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('dist/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      workflow: {
        steps: [
          {
            expression: '34',
          },
        ],
      },
      options: {},
    };

    engine.listen(plan.id, {
      [e.WORKFLOW_COMPLETE]: ({ state }: e.WorkflowCompletePayload) => {
        t.is(state, 34);

        // Apparently engine.destroy won't resolve if we return immediately
        setTimeout(done, 1);
      },
    });
    engine.execute(plan, {});
  });
});

test.serial('catch and emit errors', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('dist/test/worker-functions.js');
    engine = await createEngine(options, p);

    const plan = {
      id: 'a',
      workflow: {
        steps: [
          {
            expression: 'throw new Error("test")',
          },
        ],
      },
      options: {},
    };

    engine.listen(plan.id, {
      [e.WORKFLOW_ERROR]: ({ message }: e.WorkflowErrorPayload) => {
        t.is(message, 'test');
        done();
      },
    });

    engine.execute(plan, {});
  });
});

test.serial(
  'timeout the whole run and emit an error (timeout on run)',
  async (t) => {
    return new Promise(async (done) => {
      const p = path.resolve('dist/test/worker-functions.js');
      engine = await createEngine(options, p);

      const plan = {
        id: 'a',
        workflow: {
          steps: [
            {
              expression: 'while(true) {}',
            },
          ],
        },
        options: {},
      };

      // TODO Now then - this doesn't seem right
      // the timeout should be on the xplan
      const opts: ExecuteOptions = {
        runTimeoutMs: 10,
      };

      engine.listen(plan.id, {
        [e.WORKFLOW_ERROR]: ({ message, type }: e.WorkflowErrorPayload) => {
          t.is(type, 'TimeoutError');
          t.regex(message, /failed to return within 10ms/);
          done();
        },
      });

      engine.execute(plan, {}, opts);
    });
  }
);

test.serial(
  'timeout the whole run and emit an error (default engine timeout) ',
  async (t) => {
    return new Promise(async (done) => {
      const p = path.resolve('dist/test/worker-functions.js');
      engine = await createEngine(
        {
          ...options,
          runTimeoutMs: 22,
        },
        p
      );

      const plan = {
        id: 'a',
        workflow: {
          steps: [
            {
              expression: 'while(true) {}',
            },
          ],
        },
        options: {},
      };

      engine.listen(plan.id, {
        [e.WORKFLOW_ERROR]: ({ message, type }: e.WorkflowErrorPayload) => {
          t.is(type, 'TimeoutError');
          t.regex(message, /failed to return within 22ms/);
          done();
        },
      });

      engine.execute(plan, {});
    });
  }
);

// Run this in a simple in-memory loop
// Is usage consistent here? Yes, usually <=4ms
test.serial.skip(
  'control: does not slow down on consecutive runs',
  async (t) => {
    const exp = 'new Array(1e6).fill(1).join("-")';

    const timings = [];
    let count = 500;
    t.timeout(1000 * 60 * 5);

    while (count--) {
      let start = Date.now();
      eval(exp);
      timings.push(Date.now() - start);
    }

    let min = Infinity;
    let max = 0;
    for (const d of timings) {
      if (d < min) {
        min = d;
      }
      if (d > max) {
        max = d;
      }
    }
    t.log(min, max);
    // Ensure minimal timing drift
    // locally, this passes even after 500 iterations
    // (but doing les than this in CI)
    t.true(max - min < 6);
  }
);

// Over 500 runs this does seem to slow down a bit
test.serial.skip('does not slow down on consecutive runs', async (t) => {
  return new Promise(async (done) => {
    const p = path.resolve('dist/test/worker-functions.js');
    engine = await createEngine(
      {
        ...options,
        maxWorkers: 1,
      },
      p
    );

    const plan = {
      id: 'a',
      workflow: {
        steps: [
          {
            expression: 'new Array(1e7).fill(1).join("-")',
          },
        ],
      },
      options: {},
    };

    const timings = [];
    // CI
    // let count = 50;

    // LOCAL
    let count = 500;
    t.timeout(1000 * 60 * 5);

    while (count--) {
      await new Promise((resolve) => {
        let start = Date.now();
        engine.execute(plan, {}).on(e.WORKFLOW_COMPLETE, () => {
          timings.push(Date.now() - start);
          resolve();
        });
      });
    }

    let min = Infinity;
    let max = 0;
    for (const d of timings) {
      if (d < min) {
        min = d;
      }
      if (d > max) {
        max = d;
      }
    }
    t.log(timings.join(' '));
    t.log(min, max);
    // Ensure minimal timing drift
    // locally, this passes even after 500 iterations
    // (but doing les than this in CI)
    t.true(max - min < 20);
    done();
  });
});

// quite a small variance here, ~25ms
test.serial.only(
  'does not slow down on consecutive runs with timeout',
  async (t) => {
    return new Promise(async (done) => {
      const p = path.resolve('dist/test/worker-functions.js');
      engine = await createEngine(
        {
          ...options,
          maxWorkers: 1,
        },
        p
      );

      const plan = {
        id: 'a',
        workflow: {
          steps: [
            {
              expression: 'new Array(1e7).fill(1).join("-")',
            },
          ],
        },
        options: {},
      };

      const timings = [];
      // CI
      // let count = 50;

      // LOCAL
      let count = 500;
      t.timeout(1000 * 60 * 5);

      while (count--) {
        await new Promise((resolve) => {
          let start = Date.now();
          engine.execute(plan, {}).on(e.WORKFLOW_COMPLETE, () => {
            timings.push(Date.now() - start);
            setTimeout(resolve, 200);
          });
        });
      }

      let min = Infinity;
      let max = 0;
      for (const d of timings) {
        if (d < min) {
          min = d;
        }
        if (d > max) {
          max = d;
        }
      }
      t.log(min, max);
      // Ensure minimal timing drift
      // locally, this passes even after 500 iterations
      // (but doing les than this in CI)
      t.true(max - min < 40);
      done();
    });
  }
);
