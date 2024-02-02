import test from 'ava';
import run from '../src/runtime';

import { createMockLogger } from '@openfn/logger';
import { State } from '@openfn/lexicon';

const createState = (data = {}) => ({ data, configuration: {} });

test('makes parseInt available inside the job', async (t) => {
  const expression = `
    export default [
      (s) => { s.data.count = parseInt(s.data.count); return s; }
    ];`;
  const input = createState({ count: '22' });

  const result = await run(expression, input);
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

  const result = await run(expression, state);
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

  await t.throwsAsync(() => run(expression, {}, { logger }), {
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

  await t.throwsAsync(() => run(expression, {}, { logger }), {
    name: 'SecurityError',
    message: /Illegal eval statement detected/,
  });
});
