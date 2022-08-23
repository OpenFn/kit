import test from "ava";
import { fn } from '@openfn/language-common';
import type { State } from '@openfn/language-common';
import run from '../src/runtime';

const createState = (data = {}) => ({
  data: data,
  configuration: {}
});

test('a no-op job with one operation', async (t) => {
  const job = [(s: State) => s];
  const state = createState();
  const result = await run(job, state);

  t.deepEqual(state, result);
})

test('a no-op job with one fn operation', async (t) => {
  const job = [fn((s: State) => s)];
  const state = createState();
  const result = await run(job, state);

  t.deepEqual(state, result);
})

// test('should call the logger', () => {
  
// })