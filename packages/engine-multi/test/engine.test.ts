import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import { createPlan } from '../src/test/util';

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
};

test.afterEach(() => {
  logger._reset();
});

test('create an engine', (t) => {
  const engine = createEngine(options);
  t.truthy(engine);
  t.is(engine.constructor.name, 'Engine');
  t.truthy(engine.execute);
  t.truthy(engine.on);
  t.truthy(engine.once);
  t.truthy(engine.emit);
});

test('register a workflow', (t) => {
  const plan = { id: 'z' };
  const engine = createEngine(options);

  const state = engine.registerWorkflow(plan);

  t.is(state.status, 'pending');
  t.is(state.id, plan.id);
  t.deepEqual(state.plan, plan);
});

test('get workflow state', (t) => {
  const plan = { id: 'z' } as ExecutionPlan;
  const engine = createEngine(options);

  const s = engine.registerWorkflow(plan);

  const state = engine.getWorkflowState(plan.id);

  t.deepEqual(state, s);
});

test('use the default worker path', (t) => {
  const engine = createEngine({ logger, repoDir: '.' });
  t.true(engine.workerPath.endsWith('worker/worker.js'));
});

// Note that even though this is a nonsense path, we get no error at this point
test('use a custom worker path', (t) => {
  const p = 'jam';
  const engine = createEngine(options, p);
  t.is(engine.workerPath, p);
});

test('execute with test worker and trigger workflow-complete', (t) => {
  return new Promise((done) => {
    const p = path.resolve('src/test/worker-functions.js');
    const engine = createEngine(
      {
        logger,
        repoDir: '.',
        noCompile: true,
        autoinstall: {
          handleIsInstalled: async () => true,
        },
      },
      p
    );

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
      done();
    });
  });
});

test('execute does not return internal state stuff', (t) => {
  return new Promise((done) => {
    const p = path.resolve('src/test/worker-functions.js');
    const engine = createEngine(
      {
        logger,
        noCompile: true,
        autoinstall: {
          handleIsInstalled: async () => true,
        },
      },
      p
    );

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: '22',
        },
      ],
    };

    const result = engine.execute(plan);
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

test('listen to workflow-complete', (t) => {
  return new Promise((done) => {
    const p = path.resolve('src/test/worker-functions.js');
    const engine = createEngine(
      {
        logger,
        noCompile: true,
        autoinstall: {
          handleIsInstalled: async () => true,
        },
      },
      p
    );

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: '33',
        },
      ],
    };

    engine.execute(plan);
    engine.listen(plan.id, {
      [e.WORKFLOW_COMPLETE]: ({ state, threadId }) => {
        t.is(state, 33);
        t.truthy(threadId); // proves (sort of) that this has run in a worker
        done();
      },
    });
  });
});
