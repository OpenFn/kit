import test from 'ava';
import run from '../src/runtime';

import { createMockLogger } from '@openfn/logger';
import { State } from '@openfn/lexicon';

const createState = (data = {}) => ({ data, configuration: {} });

const createPlan = (expression: string, initialState: State) => ({
  workflow: {
    jobs: [
      {
        expression,
      },
    ],
  },
  options: {
    initialState,
  },
});

test('makes parseInt available inside the job', async (t) => {
  const expression = `
    export default [
      (s) => { s.data.count = parseInt(s.data.count); return s; }
    ];`;
  const intialState = createState({ count: '22' });
  const plan = createPlan(expression, intialState);

  const result = await run(plan);
  t.deepEqual(result.data, { count: 22 });
});

test('makes Set available inside the job', async (t) => {
  const expression = `
    export default [
      (s) => {
        new Set(); // should not throw
        return s;
      }
    ];`;

  const state = createState({ count: '33' });
  const plan = createPlan(expression, state);

  const result = await run(plan);
  t.deepEqual(result.data, { count: '33' });
});

test("doesn't allow process inside the job", async (t) => {
  const logger = createMockLogger(undefined, { level: 'default' });
  const expression = `
    export default [
      (s) => {
        process.exit()
        return s;
      }
    ];`;

  const plan = createPlan(expression, createState());

  await t.throwsAsync(() => run(plan, { logger }), {
    name: 'RuntimeCrash',
    message: 'ReferenceError: process is not defined',
  });
});

test("doesn't allow eval inside a job", async (t) => {
  const logger = createMockLogger(undefined, { level: 'default' });
  const expression = `
    export default [
      (state) => eval('ok') // should throw
    ];`;

  const plan = createPlan(expression, createState());
  await t.throwsAsync(() => run(plan, { logger }), {
    name: 'SecurityError',
    message: /Illegal eval statement detected/,
  });
});
