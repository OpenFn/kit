import test from 'ava';
import path from 'node:path';
import type { WorkflowOptions } from '@openfn/lexicon';
import compile from '@openfn/compiler';

import run from '../src/runtime';
import { extractPosition, extractStackTrace } from '../src/errors';

const createPlan = (expression: string, options: WorkflowOptions = {}) => ({
  workflow: {
    steps: [
      {
        expression,
      },
    ],
  },
  options,
});

test('extractPosition: basic test', (t) => {
  const fakeError = {
    stack: `Error: some error
 at assertRuntimeCrash (/repo/openfn/kit/packages/runtime/src/errors.ts:25:15)`,
  };

  const pos = extractPosition(fakeError);

  t.deepEqual(pos, {
    line: 25,
    column: 15,
  });
});

test("extractPosition: find errors which aren't on line 1", (t) => {
  const fakeError = {
    stack: `Error: some error
  at Number.toFixed (<anonymous>)
  at assertRuntimeCrash (/repo/openfn/kit/packages/runtime/src/errors.ts:25:15)`,
  };

  const pos = extractPosition(fakeError);

  t.deepEqual(pos, {
    line: 25,
    column: 15,
  });
});

test("extractPosition: return undefined if there's no position", (t) => {
  const fakeError = {
    stack: `Error: some error
  at Number.toFixed (<anonymous>)
  at assertRuntimeCrash (/repo/openfn/kit/packages/runtime/src/errors.ts)`,
  };

  const pos = extractPosition(fakeError);

  t.falsy(pos);
});

test('extractStackTrace: basic test', (t) => {
  const fakeError = {
    stack: `ReferenceError: z is not defined
    at vm:module(0):2:27
    at fn (vm:module(0):1:25)
    at vm:module(0):2:17
    at SourceTextModule.evaluate (node:internal/vm/module:227:23)
    at default (file:///repo/openfn/kit/packages/runtime/src/modules/module-loader.ts:29:18)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async prepareJob (file:///repo/openfn/kit/packages/runtime/src/execute/expression.ts:136:25)
    at async file:///repo/openfn/kit/packages/runtime/src/execute/expression.ts:21:45`,
  };

  const stack = extractStackTrace(fakeError);

  t.is(
    stack,
    `ReferenceError: z is not defined
    at vm:module(0):2:27
    at fn (vm:module(0):1:25)
    at vm:module(0):2:17`
  );
});

test('crash on timeout', async (t) => {
  const expression = 'export default [(s) => new Promise((resolve) => {})]';

  const plan = createPlan(expression, { timeout: 1 });
  let error: any;
  try {
    await run(plan);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'kill');
  t.is(error.message, 'Job took longer than 1ms to complete');
});

test('crash on runtime error with SyntaxError', async (t) => {
  const expression = 'export default [(s) => ~@]2q1j]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.subtype, 'SyntaxError');
  t.is(error.message, 'SyntaxError: Invalid or unexpected token');
});

test('crash on runtime error with ReferenceError', async (t) => {
  const expression = 'export default [(s) => x]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }
  t.log(error);
  t.log(error.stack);

  t.is(error.severity, 'crash');
  t.is(error.subtype, 'ReferenceError');
  t.is(error.message, 'ReferenceError: x is not defined');

  // Ensure an unmapped error position
  t.deepEqual(error.pos, {
    line: 1,
    column: 24,
  });

  // Ensure the stack trace only includes VM frames
  t.is(
    error.stack,
    `ReferenceError: x is not defined
    at vm:module(0):1:24`
  );
});

test('maps positions in a compiled ReferenceError', async (t) => {
  const expression = `function fn(f) { return f() }
fn((s) => z)`;

  // Assert that in the original code, the undeclared variable is at position 11
  const originalZPosition = expression.split('\n')[1].indexOf('z');
  t.is(originalZPosition, 10);

  // compile the code so we get a source map
  const { code, map } = compile(expression, { name: 'src' });
  t.log(code);
  let error: any;
  try {
    await run(code, {}, { sourceMap: map });
  } catch (e) {
    error = e;
  }

  const newZPosition = code.split('\n')[1].indexOf('z');
  t.is(newZPosition, 26);

  // validate that this is the error we're expecting
  t.is(error.subtype, 'ReferenceError');

  // ensure a position is written to the error
  t.deepEqual(error.pos, {
    line: 2,
    column: 11,
    src: 'fn((s) => z)',
  });

  // Positions must be mapped in the stacktrace too
  t.is(
    error.stack,
    `ReferenceError: z is not defined
    at vm:module(0):2:11
    at fn (vm:module(0):1:25)
    at vm:module(0):2:1`
  );
});

test('crash on eval with SecurityError', async (t) => {
  const expression = 'export default [(s) => eval("process.exit()")]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'kill');
  t.is(error.message, 'Illegal eval statement detected');
});

test('crash on edge condition error with EdgeConditionError', async (t) => {
  const plan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: '.',
          next: {
            b: {
              // Will throw a reference error
              condition: 'wibble',
            },
          },
        },
        { id: 'b', expression: '.' },
      ],
    },
  };

  let error: any;
  try {
    await run(plan);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.message, 'wibble is not defined');
});

test.todo('crash on input error if a function is passed with forceSandbox');

// I think I'm gonna keep this broad for now, not catch too many cases
// I'll add a tech debt issue go through and add really tight handling
// so that if something goes wrong, we know exactly what
test('crash on import error: module path provided', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

  let error: any;
  try {
    await run(expression);
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.message, 'Failed to import module "blah"');
});

test('crash on blacklisted module', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

  let error: any;
  try {
    await run(
      expression,
      {},
      {
        linker: {
          whitelist: [/^@opennfn/],
        },
      }
    );
  } catch (e) {
    error = e;
  }
  t.log(error);

  t.is(error.severity, 'crash');
  t.is(error.message, 'module blacklisted: blah');
});

test('fail on runtime TypeError', async (t) => {
  const expression = 'export default [(s) => s.x.y]';

  const result: any = await run(expression);
  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    message: "TypeError: Cannot read properties of undefined (reading 'y')",
    name: 'RuntimeError',
    subtype: 'TypeError',
    severity: 'fail',
    source: 'runtime',
    pos: {
      column: 28,
      line: 1,
    },
  });
});

test('fail on runtime error with RangeError', async (t) => {
  const expression =
    'export default [(s) => Number.parseFloat("1").toFixed(-1)]';

  const result: any = await run(expression);
  const error = result.errors['job-1'];

  t.log(error);

  t.deepEqual(error, {
    message: 'RangeError: toFixed() digits argument must be between 0 and 100',
    name: 'RuntimeError',
    subtype: 'RangeError',
    severity: 'fail',
    source: 'runtime',
    pos: {
      column: 47,
      line: 1,
    },
  });
});

test('fail on user error with new Error()', async (t) => {
  const expression = 'export default [(s) => {throw new Error("abort")}]';

  const result: any = await run(expression);

  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    message: 'abort',
    name: 'JobError',
    severity: 'fail',
    source: 'runtime',
  });
});

test('fail on user error with throw "abort"', async (t) => {
  const expression = 'export default [(s) => {throw "abort"}]';

  const result: any = await run(expression);

  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    message: 'abort',
    name: 'JobError',
    severity: 'fail',
    source: 'runtime',
  });
});

test('fail on adaptor error (with throw new Error())', async (t) => {
  const expression = `

  err();`;

  // Compile the code so that we get a source map
  const { code, map } = compile(expression, {
    name: 'src',
    'add-imports': {
      adaptors: [
        {
          name: 'x',
          exportAll: true,
        },
      ],
    },
  });

  const result: any = await run(
    code,
    {},
    {
      linker: {
        modules: {
          x: { path: path.resolve('test/__modules__/test') },
        },
      },
      sourceMap: map,
    }
  );

  const error = result.errors['job-1'];

  t.deepEqual(error, {
    details: {
      code: 1234,
    },
    message: 'adaptor err',
    name: 'AdaptorError',
    source: 'runtime',
    severity: 'fail',
    line: 3,
    operationName: 'err',
  });
});

test('fail on nested adaptor error', async (t) => {
  // have to use try/catch or we'll get an unhandled rejection error
  // TODO does this need wider testing?
  const expression = `
    fn(async (state) => {
      try {  
        await err()(state);
      } catch(e) {
        throw e;
      }
    })`;

  // Compile the code so that we get a source map
  const { code, map } = compile(expression, {
    name: 'src',
    'add-imports': {
      adaptors: [
        {
          name: 'x',
          exportAll: true,
        },
      ],
    },
  });

  const result: any = await run(
    code,
    {},
    {
      linker: {
        modules: {
          x: { path: path.resolve('test/__modules__/test') },
        },
      },
      sourceMap: map,
    }
  );

  const error = result.errors['job-1'];
  t.log(error);

  t.deepEqual(error, {
    details: {
      code: 1234,
    },
    message: 'adaptor err',
    name: 'AdaptorError',
    source: 'runtime',
    severity: 'fail',
    // In this case right now the error will report back on the parent operation
    // which is fn() on line 2 - even though the actual error occurred in the callback
    // on line 4
    line: 2,
    operationName: 'fn',
  });
});

test('adaptor error with no stack trace will be a user error', async (t) => {
  // this will throw "adaptor err"
  // Since it has no stack trace, we don't really know a lot about it
  // How can we handle a case like this?
  const expression = `
  import { err2 } from 'x';
  export default [(s) => err2()];
  `;
  const result = await run(
    expression,
    {},
    {
      linker: {
        modules: {
          x: { path: path.resolve('test/__modules__/test') },
        },
      },
    }
  );

  const error = result.errors['job-1'];

  t.log(error);

  t.deepEqual(error, {
    message: 'adaptor err',
    name: 'JobError',
    severity: 'fail',
    source: 'runtime',
  });
});
