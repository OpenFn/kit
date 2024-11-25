import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/lexicon';

import createAPI from '../src/api';
import type { RuntimeEngine } from '../src';

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
      t.truthy(evt.versions);
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

    api
      .execute(plan, emptyState)
      .on('workflow-log', (evt) => {
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
      })
      .on('workflow-complete', () => {
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
        adaptors: ['@openfn/helper@1.0.0'],
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
      t.deepEqual(state, {});

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
      t.is(evt.error.name, 'TypeError');
      t.is(evt.error.severity, 'fail');
      t.is(
        evt.error.message,
        "TypeError: Cannot read properties of undefined (reading 'y')"
      );
      done();
    });
  });
});

test.serial(
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

test.serial('use custom state-props-to-remove', (t) => {
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
    let didCallLoader = false;

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

    api.execute(plan, {}, options).on('workflow-complete', () => {
      t.true(didCallLoader);
      done();
    });
  });
});

test.serial('send a workflow error if credentials fail to load', (t) => {
  return new Promise(async (done) => {
    let didCallLoader = false;

    const loader = () =>
      new Promise<any>((_resolve, reject) => {
        setTimeout(() => {
          didCallLoader = true;
          reject();
        }, 1);
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

    api.execute(plan, {}, options).on('workflow-error', (e) => {
      t.true(didCallLoader);

      t.is(e.type, 'CredentialLoadError');
      t.is(e.severity, 'exception');
      t.is(e.message, 'Failed to load credential secret');
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
