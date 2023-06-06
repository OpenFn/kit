/**
 * Simple suite of unit tests against the mock worker API
 * Passes a job in and expects to get a simulated result back
 *
 * The mock is a real web worker which internally uses a mock runtime engine
 * Inside the worker, everything apart from execute is the same as the real environment
 */
import path from 'node:path';
import test from 'ava';
import workerpool from 'workerpool';

import { createPlan } from './util';

import * as e from '../src/events';

const workers = workerpool.pool(path.resolve('dist/mock-worker.js'));

test('execute a mock plan inside a worker thread', async (t) => {
  const plan = createPlan();
  const result = await workers.exec('run', [plan]);
  t.deepEqual(result, { data: { answer: 42 } });
});

test('execute a mock plan with data', async (t) => {
  const plan = createPlan({
    id: 'j2',
    data: { input: 44 },
  });
  const result = await workers.exec('run', [plan]);
  t.deepEqual(result, { data: { answer: 44 } });
});

test('execute a mock plan with an expression', async (t) => {
  const plan = createPlan({
    id: 'j2',
    expression: '() => ({ data: { answer: 46 } })',
  });
  const result = await workers.exec('run', [plan]);
  t.deepEqual(result, { data: { answer: 46 } });
});

test('execute a mock plan with an expression which uses state', async (t) => {
  const plan = createPlan({
    id: 'j2',
    data: { input: 2 },
    expression: '(s) => ({ data: { answer: s.data.input * 2 } })',
  });
  const result = await workers.exec('run', [plan]);
  t.deepEqual(result, { data: { answer: 4 } });
});

test('execute a mock plan with a promise expression', async (t) => {
  const plan = createPlan({
    id: 'j2',
    expression: `(s) =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({ data: { answer: 46 } })
        }, 1);
      })`,
  });
  const result = await workers.exec('run', [plan]);
  t.deepEqual(result, { data: { answer: 46 } });
});

test('expression state overrides data', async (t) => {
  const plan = createPlan({
    id: 'j2',
    data: { answer: 44 },
    expression: '() => ({ data: { agent: "007" } })',
  });
  const result = await workers.exec('run', [plan]);
  t.deepEqual(result, { data: { agent: '007' } });
});

test('write an exception to state', async (t) => {
  const plan = createPlan({
    id: 'j2',
    expression: 'ƸӜƷ', // it's a butterfly, obviously (and mmore importantly, invalid JSON)
  });
  const result = await workers.exec('run', [plan]);
  t.truthy(result.data);
  t.truthy(result.error);
});

test('execute a mock plan with delay', async (t) => {
  const start = new Date().getTime();
  const plan = createPlan({
    id: 'j1',
    _delay: 50,
  });
  await workers.exec('run', [plan]);
  const elapsed = new Date().getTime() - start;
  t.assert(elapsed > 50);
});

test('Publish workflow-start event', async (t) => {
  const plan = createPlan();
  let didFire = false;
  await workers.exec('run', [plan], {
    on: ({ type, ...args }) => {
      if (type === e.WORKFLOW_START) {
        didFire = true;
      }
    },
  });
  t.true(didFire);
});

test('Publish workflow-complete event with state', async (t) => {
  const plan = createPlan();
  let didFire = false;
  let state;
  await workers.exec('run', [plan], {
    on: ({ type, ...args }) => {
      if (type === e.WORKFLOW_COMPLETE) {
        didFire = true;
        state = args.state;
      }
    },
  });
  t.true(didFire);
  t.deepEqual(state, { data: { answer: 42 } });
});

test('Publish a job log event', async (t) => {
  const plan = createPlan({
    expression: `(s) => {
      console.log('test')
      return s;
    }`,
  });
  let didFire = false;
  let log;
  let id;
  await workers.exec('run', [plan], {
    on: ({ workflowId, type, message }) => {
      if (type === e.JOB_LOG) {
        didFire = true;
        log = message;
        id = workflowId;
      }
    },
  });
  t.true(didFire);
  t.is(id, plan.id);

  t.is(log.level, 'info');
  t.deepEqual(log.message, ['test']);
  t.is(log.name, 'JOB');
  t.truthy(log.time);
});
