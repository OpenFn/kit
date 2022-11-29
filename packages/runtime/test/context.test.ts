import test from 'ava';
import run from '../src/runtime';

const createState = (data = {}) => ({ data, configuration: {} });

test('makes parseInt available inside the job', async (t) => {
  const job = `
    export default [
      (s) => parseInt(s.data)
    ];`;

  const result = await run(job, createState('22'));
  t.is(result, 22);
});

test('makes Set available inside the job', async (t) => {
  const job = `
    export default [
      (s) => {
        new Set(); // should not throw
        return s;
      }
    ];`;

  const result = await run(job, createState('33'));
  t.is(result.data, '33');
});

test("doesn't allow process inside the job", async (t) => {
  const job = `
    export default [
      (s) => {
        process.exit()
        return s;
      }
    ];`;

  const state = createState();
  await t.throwsAsync(async () => await run(job, state), {
    message: 'process is not defined',
  });
});

test("doesn't allow eval inside a job", async (t) => {
  const job = `
    export default [
      (state) => eval('ok') // should throw
    ];`;

  await t.throwsAsync(async () => await run(job, createState()), {
    message: 'Code generation from strings disallowed for this context',
  });
});

// TODO exhaustive test of globals?
// TODO ensure an imported module can't access eval/process
