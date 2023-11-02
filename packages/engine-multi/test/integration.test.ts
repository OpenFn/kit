import test from 'ava';
import createAPI from '../src/api';
import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger();
let api;

test.afterEach(() => {
  logger._reset();
  api.destroy()
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

    api.execute(plan).on('job-start', () => {
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

    api.execute(plan).on('job-complete', () => {
      t.pass('job completed');
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

    api.execute(plan, options).on('workflow-complete', ({ state }) => {
      t.true(didCallLoader);
      done();
    });
  });
});

test.todo('should report an error');
test.todo('various workflow options (start, initial state)');
