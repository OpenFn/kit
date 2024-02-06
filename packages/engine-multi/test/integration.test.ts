import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';

import createAPI from '../src/api';
import type { RuntimeEngine } from '../src';
import { ExecutionPlan } from '@openfn/lexicon';

const logger = createMockLogger();
let api: RuntimeEngine;

const emptyState = {};

test.afterEach(() => {
  logger._reset();
  api.destroy();
});

// this tests the full API with the actual runtime
// note that it won't test autoinstall
// (using jobs with no adaptors should be fine)

// actually putting in a good suite of tests here and now is probably more valuable
// than "full" integration tests

const withFn = `function fn(f) { return (s) => f(s) }
`;

let idgen = 0;

const createPlan = (jobs?: any[]) =>
  ({
    id: `${++idgen}`,
    workflow: {
      steps: jobs || [
        {
          id: 'j1',
          expression: 'export default [s => s]',
        },
      ],
    },
    options: {},
  } as ExecutionPlan);

test.serial('trigger workflow-start', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      compile: {
        skip: true,
      },
    });

    const plan = createPlan();

    api.execute(plan, emptyState).on('workflow-start', (evt) => {
      t.is(evt.workflowId, plan.id);
      t.truthy(evt.threadId);
      t.pass('workflow started');
      done();
    });
  });
});

test.serial('trigger job-start', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      compile: {
        skip: true,
      },
    });

    const plan = createPlan();

    api.execute(plan, emptyState).on('job-start', (e) => {
      t.is(e.workflowId, '2');
      t.is(e.jobId, 'j1');
      t.truthy(e.threadId);
      t.truthy(e.versions);
      t.pass('job started');
      done();
    });
  });
});

test.serial('trigger job-complete', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      compile: {
        skip: true,
      },
    });

    const plan = createPlan();

    api.execute(plan, emptyState).on('job-complete', (evt) => {
      t.deepEqual(evt.next, []);
      t.log('duration:', evt.duration);
      // Very lenient duration test - this often comes in around 200ms in CI
      // (because of parelleisation in the tests I think)
      t.true(evt.duration < 200);
      t.is(evt.jobId, 'j1');
      t.deepEqual(evt.state, { data: {} });
      t.pass('job completed');
      t.truthy(evt.mem.job);
      t.truthy(evt.mem.system);
      done();
    });
  });
});

test.todo('trigger multiple job-completes');

test.serial('trigger workflow-complete', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      compile: {
        skip: true,
      },
    });

    const plan = createPlan();

    api.execute(plan, emptyState).on('workflow-complete', (evt) => {
      t.falsy(evt.state.errors);

      t.is(evt.workflowId, plan.id);
      t.truthy(evt.duration);
      t.truthy(evt.state);
      t.truthy(evt.threadId);
      t.pass('workflow completed');
      done();
    });
  });
});

test.serial('trigger workflow-log for job logs', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
    });

    const plan = createPlan([
      {
        expression: `${withFn}fn((s) => { console.log('hola'); return s; })`,
      },
    ]);

    let didLog = false;

    api.execute(plan, emptyState).on('workflow-log', (evt) => {
      if (evt.name === 'JOB') {
        didLog = true;
        t.deepEqual(evt.message, JSON.stringify(['hola']));
        t.pass('workflow logged');
      }
    });

    api.execute(plan, emptyState).on('workflow-complete', (evt) => {
      t.true(didLog);
      t.falsy(evt.state.errors);
      done();
    });
  });
});

test.serial('log errors', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
    });

    const plan = createPlan([
      {
        expression: `${withFn}fn((s) => { console.log(new Error('hola')); return s; })`,
      },
    ]);

    api.execute(plan, emptyState).on('workflow-log', (evt) => {
      if (evt.name === 'JOB') {
        t.log(evt);
        t.deepEqual(
          evt.message,
          JSON.stringify([
            {
              name: 'Error',
              message: 'hola',
            },
          ])
        );
        t.pass('workflow logged');
      }
    });

    api.execute(plan, emptyState).on('workflow-complete', () => {
      done();
    });
  });
});

test.serial('trigger workflow-log for adaptor logs', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      repoDir: path.resolve('./test/__repo__'),
    });

    const plan = createPlan([
      {
        // This will trigger console.log from inside the adaptor
        // rather than from job code directly
        expression: "log('hola')",
        adaptor: '@openfn/helper@1.0.0',
      },
    ]);

    api.execute(plan, emptyState).on('workflow-log', (evt) => {
      if (evt.name === 'ADA') {
        t.deepEqual(evt.message, JSON.stringify(['hola']));
        t.pass('workflow logged');
        done();
      }
    });
  });
});

test.serial('compile and run', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
    });

    const plan = createPlan([
      {
        expression: `${withFn}fn(() => ({ data: 42 }))`,
      },
    ]);

    api.execute(plan, emptyState).on('workflow-complete', ({ state }) => {
      t.deepEqual(state.data, 42);
      done();
    });
  });
});

test.serial('run without error if no state is returned', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
    });

    const plan = createPlan([
      {
        expression: `${withFn}fn(() => {})`,
      },
    ]);

    api.execute(plan, emptyState).on('workflow-complete', ({ state }) => {
      t.falsy(state);

      // Ensure there are no error logs
      const err = logger._find('error', /./);
      t.falsy(err);
      done();
    });
  });
});

test.serial('errors get nicely serialized', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
    });

    const plan = createPlan([
      {
        expression: `${withFn}fn((s) => s.data.x.y)`,
      },
    ]);

    api.execute(plan, emptyState).on('job-error', (evt) => {
      t.is(evt.error.type, 'TypeError');
      t.is(evt.error.severity, 'fail');
      t.is(
        evt.error.message,
        "TypeError: Cannot read properties of undefined (reading 'y')"
      );
      done();
    });
  });
});

// TODO I need to get options working before I can fix this one
// statePropsToRemove needs to be fed through to the actual runtime on the option key
test.serial.skip(
  'execute should remove the configuration and response keys',
  (t) => {
    return new Promise(async (done) => {
      api = await createAPI({
        logger,
      });

      const plan = createPlan([
        {
          id: 'j',
          expression: `${withFn}fn(() => ({ a: 1, configuration: {}, response: {} }))`,
        },
      ]);

      api.execute(plan, emptyState).on('workflow-complete', ({ state }) => {
        t.deepEqual(state, { a: 1 });
        done();
      });
    });
  }
);

// TODO ditto
test.serial.skip('use custom state-props-to-remove', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      statePropsToRemove: ['x'],
    });

    const plan = createPlan([
      {
        id: 'j',
        expression: `${withFn}fn(() => ({ x: 1, configuration: {}, response: {} }))`,
      },
    ]);

    api.execute(plan, emptyState).on('workflow-complete', ({ state }) => {
      t.deepEqual(state, { configuration: {}, response: {} });
      done();
    });
  });
});

test.serial('evaluate conditional edges', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
    });

    const jobs = [
      {
        id: 'a',
        next: {
          b: true,
          c: false,
        },
      },
      {
        id: 'b',
        expression: `${withFn}fn(() => ({ data: 'b' }))`,
      },
      {
        id: 'c',
        expression: `${withFn}fn(() => ({ data: 'c' }))`,
      },
    ];

    const plan = createPlan(jobs);

    api.execute(plan, emptyState).on('workflow-complete', ({ state }) => {
      t.deepEqual(state.data, 'b');
      done();
    });
  });
});

test.serial('preload credentials', (t) => {
  return new Promise(async (done) => {
    let didCallLoader = true;

    const loader = (id: string) =>
      new Promise<any>((resolve) => {
        setTimeout(() => {
          didCallLoader = true;
          t.is(id, 'secret');
          resolve({});
        }, 100);
      });

    api = await createAPI({
      logger,
    });

    const options = {
      resolvers: {
        credential: loader,
      },
    };

    const jobs = [
      {
        id: 'a',
        configuration: 'secret',
      },
    ];

    const plan = createPlan(jobs);

    api.execute(plan, options).on('workflow-complete', () => {
      t.true(didCallLoader);
      done();
    });
  });
});

test.serial('accept initial state', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      compile: {
        skip: true,
      },
    });

    const plan = createPlan();

    const input = {
      x: 1,
      data: {
        y: 1,
      },
    };

    api.execute(plan, input).on('workflow-complete', ({ state }) => {
      t.deepEqual(state, input);
      done();
    });
  });
});

test.todo('should report an error');
test.todo('various workflow options (start, initial state)');
