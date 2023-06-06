import test from 'ava';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import { createPlan } from './util';

import Manager from '../src/rtm';
import * as e from '../src/events';

const logger = createMockLogger('', { level: 'debug' });

const options = {
  // This uses the mock worker, not the actual runtime
  // It will still exercise all the lifecycle logic found in the worker-helper,
  // Just not the runtime logic
  workerPath: path.resolve('dist/mock-worker.js'),
  logger,
  repoDir: '', // doesn't matter for the mock
  noCompile: true, // messy - needed to allow an expression to be passed as json
};

test.afterEach(() => {
  logger._reset();
});

test('Should create a new manager', (t) => {
  const rtm = Manager('x', options);
  t.truthy(rtm);
  t.truthy(rtm.execute);
  t.truthy(rtm.on);
  t.truthy(rtm.once);
  t.is(rtm.id, 'x');
});

test('Should run a mock job with a simple return value', async (t) => {
  const state = { data: { x: 1 } };
  const rtm = Manager('x', options);
  const plan = createPlan({
    expression: `() => (${JSON.stringify(state)})`,
  });
  const result = await rtm.execute(plan);
  t.deepEqual(result, state);
});

test('Should not explode if no adaptor is passed', async (t) => {
  const state = { data: { x: 1 } };
  const rtm = Manager('x', options);
  const plan = createPlan({
    expression: `() => (${JSON.stringify(state)})`,
  });

  // @ts-ignore
  delete plan.jobs[0].adaptor;
  const result = await rtm.execute(plan);
  t.deepEqual(result, state);
});

test('events: workflow-start', async (t) => {
  const rtm = Manager('x', options);

  let id;
  let didCall;
  rtm.on(e.WORKFLOW_START, ({ workflowId }) => {
    didCall = true;
    id = workflowId;
  });

  const plan = createPlan();
  await rtm.execute(plan);

  t.true(didCall);
  t.is(id, plan.id);
});

test('events: workflow-complete', async (t) => {
  const rtm = Manager('x', options);

  let didCall;
  let evt;
  rtm.on(e.WORKFLOW_COMPLETE, (e) => {
    didCall = true;
    evt = e;
  });

  const plan = createPlan();
  await rtm.execute(plan);

  t.true(didCall);
  t.is(evt.workflowId, plan.id);
  t.truthy(evt.duration);
  t.deepEqual(evt.state, { data: { answer: 42 } });
});

test('events: workflow-log', async (t) => {
  const rtm = Manager('x', options);

  let didCall;
  let evt;
  rtm.on(e.WORKFLOW_COMPLETE, (e) => {
    didCall = true;
    evt = e;
  });

  const plan = createPlan();
  await rtm.execute(plan);

  t.true(didCall);
  t.is(evt.workflowId, plan.id);
  t.truthy(evt.duration);
  t.deepEqual(evt.state, { data: { answer: 42 } });
});

// TODO events: logging. How will I test this with the mock?
