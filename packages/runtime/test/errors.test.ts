import test from 'ava';
import path from 'node:path';
import type { WorkflowOptions } from '@openfn/lexicon';

import run from '../src/runtime';
import { RuntimeError, serialize } from '../src/errors';

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

test('serialize a basic Error', (t) => {
  const e: any = new Error('test_error');
  e.code = 297;

  const result = serialize(e);
  t.log(result);
  t.deepEqual(result, {
    type: 'Error',
    message: 'test_error',
    details: {
      code: 297,
    },
  });
});

test('serialize a RuntimeError', (t) => {
  const inner = new TypeError('bad types');
  const e: any = new RuntimeError(inner);
  t.log(e);
  const result = serialize(e);
  t.log(result);
  t.deepEqual(result, {
    type: 'RuntimeError', // type should be the class name
    message: 'bad types',
    details: {
      severity: 'fail',
      source: 'runtime',
      type: 'TypeError',
    },
  });
});

test('serialize an error from the HTTP adaptors', (t) => {
  const statusCode = 404;
  const statusMessage = 'Not Found';
  const url = 'wwww';
  const duration = 1234;
  const method = 'GET';
  const body = { message: 'server said no' };
  const headers = { 'content-type': 'application/json' };

  // This is copied out of the common http utils
  const error: any = new Error('request failed');
  error.statusCode = statusCode;
  error.statusMessage = statusMessage;
  error.url = url;
  error.duration = duration;
  error.method = method;
  error.body = body;
  error.headers = headers;

  const result = serialize(error);
  t.log(result);
  t.deepEqual(result, {
    type: 'Error',
    message: 'request failed',
    details: {
      statusCode,
      statusMessage,
      url,
      duration,
      method,
      body,
      headers,
    },
  });
});

test('serialize a string', (t) => {
  const e: any = 'something went wrong';

  const result = serialize(e);
  t.log(result);
  t.deepEqual(result, {
    type: 'Error',
    message: e,
  });
});

test('serialize an object', (t) => {
  const e: any = { code: 1234, reason: 'idk' };

  const result = serialize(e);
  t.log(result);
  t.deepEqual(result, {
    type: 'Error',
    // message: 'An error occurred',
    details: {
      code: 1234,
      reason: 'idk',
    },
  });
});

test('serialize a weird error-like object', (t) => {
  const e: any = { message: 'something went wrong' };

  const result = serialize(e);
  t.log(result);
  t.deepEqual(result, {
    type: 'Error',
    // message: 'something went wrong',
    details: {
      message: 'something went wrong',
    },
  });
});

test('crash on timeout', async (t) => {
  const expression = 'export default [(s) => new Promise((resolve) => {})]';

  const plan = createPlan(expression, { timeout: 1 });

  try {
    await run(plan);
  } catch (error) {
    t.deepEqual(error, {
      type: 'TimeoutError',
      message: 'Job took longer than 1ms to complete',
      details: {
        source: 'runtime',
        severity: 'kill',
      },
    });
  }
});

test('crash on runtime error with SyntaxError', async (t) => {
  const expression = 'export default [(s) => ~@]2q1j]';

  try {
    await run(expression);
  } catch (error) {
    t.deepEqual(error, {
      type: 'RuntimeCrash',
      message: 'Invalid or unexpected token',
      details: {
        source: 'runtime',
        severity: 'crash',
        type: 'SyntaxError',
      },
    });
  }
});

test('crash on runtime error with ReferenceError', async (t) => {
  const expression = 'export default [(s) => x]';

  try {
    await run(expression);
  } catch (error) {
    t.deepEqual(error, {
      type: 'RuntimeCrash',
      message: 'x is not defined',
      details: {
        source: 'runtime',
        severity: 'crash',
        type: 'ReferenceError',
      },
    });
  }
});

test('crash on eval with SecurityError', async (t) => {
  const expression = 'export default [(s) => eval("process.exit()")]';

  try {
    await run(expression);
  } catch (error) {
    t.deepEqual(error, {
      type: 'SecurityError',
      message: 'Illegal eval statement detected',
      details: {
        source: 'runtime',
        severity: 'kill',
      },
    });
  }
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

  try {
    await run(plan);
  } catch (error) {
    t.deepEqual(error, {
      type: 'EdgeConditionError',
      message: 'wibble is not defined',
      details: {
        source: 'runtime',
        severity: 'crash',
      },
    });
  }
});

test.todo('crash on input error if a function is passed with forceSandbox');

// I think I'm gonna keep this broad for now, not catch too many cases
// I'll add a tech debt issue go through and add really tight handling
// so that if something goes wrong, we know exactly what
test('crash on import error: module path provided', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

  try {
    await run(expression);
  } catch (error) {
    t.deepEqual(error, {
      type: 'ImportError',
      message: 'Failed to import module "blah"',
      details: {
        source: 'runtime',
        severity: 'crash',
      },
    });
  }
});

test('crash on blacklisted module', async (t) => {
  const expression = 'import x from "blah"; export default [(s) => x]';

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
  } catch (error) {
    t.deepEqual(error, {
      type: 'ImportError',
      message: 'module blacklisted: blah',
      details: {
        source: 'runtime',
        severity: 'crash',
      },
    });
  }
});

test('fail on runtime TypeError', async (t) => {
  const expression = 'export default [(s) => s.x.y]';

  const result = await run(expression);
  const error = result.errors['job-1'];

  t.deepEqual(error, {
    type: 'RuntimeError',
    message: "Cannot read properties of undefined (reading 'y')",
    details: {
      source: 'runtime',
      severity: 'fail',
      type: 'TypeError',
    },
  });
});

// TODO not totally convinced on this one actually
test('fail on runtime error with RangeError', async (t) => {
  const expression =
    'export default [(s) => Number.parseFloat("1").toFixed(-1)]';

  const result = await run(expression);
  const error = result.errors['job-1'];

  t.deepEqual(error, {
    type: 'RuntimeError',
    message: 'toFixed() digits argument must be between 0 and 100',
    details: {
      source: 'runtime',
      severity: 'fail',
      type: 'RangeError',
    },
  });
});

test('fail on user error with new Error()', async (t) => {
  const expression = 'export default [(s) => {throw new Error("abort")}]';

  const result = await run(expression);

  const error = result.errors['job-1'];

  t.deepEqual(error, {
    type: 'JobError',
    message: 'abort',
    details: {
      source: 'runtime',
      severity: 'fail',
    },
  });
});

test('fail on user error with throw "abort"', async (t) => {
  const expression = 'export default [(s) => {throw "abort"}]';

  const result = await run(expression);

  const error = result.errors['job-1'];

  t.deepEqual(error, {
    type: 'JobError',
    message: 'abort',
    details: {
      source: 'runtime',
      severity: 'fail',
    },
  });
});

test('fail on adaptor error (with throw new Error())', async (t) => {
  const expression = `
  import { err } from 'x';
  export default [(s) => err()];
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

  t.deepEqual(error, {
    type: 'AdaptorError',
    message: 'adaptor err',
    details: {
      source: 'runtime',
      severity: 'fail',
    },
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

  t.deepEqual(error, {
    type: 'JobError',
    message: 'adaptor err',
    details: {
      source: 'runtime',
      severity: 'fail',
    },
  });
});
