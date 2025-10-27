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
