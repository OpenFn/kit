import test from 'ava';
import path from 'node:path';
import createAPI from '../src/api';
import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger();
let api;

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

const createPlan = (jobs?: any[]) => ({
  id: `${++idgen}`,
  jobs: jobs || [
    {
      id: 'j1',
      expression: 'export default [s => s]',
    },
  ],
});

test.serial('trigger workflow-start', (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      compile: {
        skip: true,
      },
    });

    const plan = createPlan();

    api.execute(plan).on('workflow-start', (evt) => {
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

    api.execute(plan).on('job-start', (e) => {
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

    api.execute(plan).on('job-complete', (evt) => {
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

    api.execute(plan).on('workflow-complete', (evt) => {
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
      compile: {
        skip: true,
      },
    });

    const plan = createPlan([
      {
        expression: `${withFn}console.log('hola')`,
      },
    ]);

    api.execute(plan).on('workflow-log', (evt) => {
      if (evt.name === 'JOB') {
        t.deepEqual(evt.message, ['hola']);
        t.pass('workflow logged');
        done();
      }
    });
  });
});

test.serial.only('trigger workflow-log for adaptor logs', (t) => {
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

    api.execute(plan).on('workflow-log', (evt) => {
      if (evt.name === 'ADA') {
        t.deepEqual(evt.message, ['hola']);
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

    api.execute(plan).on('workflow-complete', ({ state }) => {
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

    api.execute(plan).on('workflow-complete', ({ state }) => {
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

    api.execute(plan).on('job-error', (evt) => {
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

      api.execute(plan).on('workflow-complete', ({ state }) => {
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

    api.execute(plan).on('workflow-complete', ({ state }) => {
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

    api.execute(plan).on('workflow-complete', ({ state }) => {
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

    // important!  The runtime  must use both x and y as initial state
    // if we run the runtime in strict mode, x will be ignored
    plan.initialState = {
      x: 1,
      data: {
        y: 1,
      },
    };

    api.execute(plan).on('workflow-complete', ({ state }) => {
      t.deepEqual(state, plan.initialState);
      done();
    });
  });
});

test.todo('should report an error');
test.todo('various workflow options (start, initial state)');
