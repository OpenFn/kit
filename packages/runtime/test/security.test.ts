// a suite of tests with various security concerns in mind
import test from 'ava';
import run, { ERR_RUNTIME_EXCEPTION, ERR_TIMEOUT } from '../src/runtime';

import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger(undefined, { level: 'default' });
test.afterEach(() => {
  logger._reset();
});

// TODO use of globalthis is kinda interesting - I expect global to be available?
test.serial('jobs should not have access to global scope', async (t) => {
  const src = 'export default [() => globalThis.x]';
  globalThis.x = 42;

  const result = await run(src);
  t.falsy(result);

  delete globalThis.x;
});

test.serial('jobs should be able to read global state', async (t) => {
  const src = 'export default [() => state.x]';

  const result = await run(src, { x: 42 }); // typings are a bit tricky
  t.is(result, 42);
});

test.serial('jobs should be able to mutate global state', async (t) => {
  const src = 'export default [() => { state.x = 22; return state.x; }]';

  const result = await run(src, { x: 42 }); // typings are a bit tricky
  t.is(result, 22);
});

test.serial('jobs should each run in their own context', async (t) => {
  const src1 = 'export default [() => { globalThis.x = 1; return 1;}]';
  const src2 = 'export default [() => globalThis.x]';

  await run(src1);

  const r1 = await run(src1);
  t.is(r1, 1);

  const r2 = await run(src2);
  t.is(r2, undefined);
});

test.serial('jobs should not have a process object', async (t) => {
  const src = 'export default [() => process.pid]';

  await t.throwsAsync(() => run(src, undefined, { logger }), {
    message: ERR_RUNTIME_EXCEPTION,
  });

  // find the exception
  const errLog = logger._history.at(-1);
  const { message, level } = logger._parse(errLog);

  t.is(level, 'error');
  t.is((message as Error).message, 'process is not defined');
});

test.serial(
  'jobs should not be able to pass a string to setTimeout',
  async (t) => {
    const src = 'export default [() => setTimeout("hacking ur scriptz", 1)]';

    await t.throwsAsync(() => run(src, undefined, { logger }), {
      message: ERR_RUNTIME_EXCEPTION,
    });

    t.log(logger._history);
    // find the exception
    const errLog = logger._history.at(-1);
    const { message, level } = logger._parse(errLog);

    t.is(level, 'error');
    t.is(
      (message as Error).message,
      'The "callback" argument must be of type function. Received type string (\'hacking ur scriptz\')'
    );
  }
);

test.serial('jobs should be able to use sensible timeouts', async (t) => {
  const src =
    'export default [() => new Promise((resolve) => setTimeout(() => resolve(22), 1))]';

  const result = await run(src);
  t.is(result, 22);
});
