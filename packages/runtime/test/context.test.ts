import test from 'ava';
import run, { ERR_RUNTIME_EXCEPTION } from '../src/runtime';

import { createMockLogger } from '@openfn/logger';

const createState = (data = {}) => ({ data, configuration: {} });

test('makes parseInt available inside the job', async (t) => {
  const job = `
    export default [
      (s) => { s.data.count = parseInt(s.data.count); return s; }
    ];`;

  const result = await run(job, createState({ count: '22' }));
  t.deepEqual(result.data, { count: 22 });
});

test('makes Set available inside the job', async (t) => {
  const job = `
    export default [
      (s) => {
        new Set(); // should not throw
        return s;
      }
    ];`;

  const result = await run(job, createState({ count: '33' }));
  t.deepEqual(result.data, { count: '33' });
});

test("doesn't allow process inside the job", async (t) => {
  const logger = createMockLogger(undefined, { level: 'default' });
  const job = `
    export default [
      (s) => {
        process.exit()
        return s;
      }
    ];`;

  const state = createState();
  await t.throwsAsync(async () => await run(job, state, { logger }), {
    message: ERR_RUNTIME_EXCEPTION,
  });

  const errLog = logger._history.at(-1);
  const { message, level } = logger._parse(errLog!);

  t.is(level, 'error');
  t.regex(message as string, /process is not defined/);
});

test("doesn't allow eval inside a job", async (t) => {
  const logger = createMockLogger(undefined, { level: 'default' });
  const job = `
    export default [
      (state) => eval('ok') // should throw
    ];`;

  await t.throwsAsync(async () => await run(job, createState(), { logger }), {
    message: ERR_RUNTIME_EXCEPTION,
  });

  const errLog = logger._history.at(-1);
  const { message, level } = logger._parse(errLog!);

  t.is(level, 'error');
  t.regex(
    message as string,
    /Code generation from strings disallowed for this context/
  );
});

// TODO exhaustive test of globals?
// TODO ensure an imported module can't access eval/process
