import test from 'ava';
import { createMockLogger } from '@openfn/logger';

import execute from '../../src/util/execute';
import { wrapOperation } from '../../src/execute/expression';

import type { Operation } from '@openfn/lexicon';

const logger = createMockLogger();

// This function mimics the reducer created in src/execute/expression.ts
const reducer = async (operations: Operation[], state: any) => {
  const mapped = operations.map((op, idx) =>
    wrapOperation(op, logger, `${idx + 1}`, idx)
  );

  return execute(...mapped)(state);
};

test('return state', async (t) => {
  const op = (s: any) => s;
  const state = { x: 1 };

  const result = await reducer([op], state);

  t.deepEqual(result, { x: 1 });
});

test('return state async', async (t) => {
  const op = async (s: any) => s;
  const state = { x: 1 };

  const result = await reducer([op], state);

  t.deepEqual(result, { x: 1 });
});

test('call one operation', async (t) => {
  const op = (s: any) => s + 1;

  const result = await reducer([op], 1);

  t.deepEqual(result, 2);
});

test('call several operations', async (t) => {
  const op = async (s: any) => s + 1;

  const result = await reducer([op, op, op], 0);

  t.deepEqual(result, 3);
});

test('rethrow a thrown error', async (t) => {
  const op = () => {
    throw new Error('err');
  };

  await t.throwsAsync(() => reducer([op], {}), {
    message: 'err',
  });
});

test('rethrow a thrown error async', async (t) => {
  const op = async () => {
    throw new Error('err');
  };

  await t.throwsAsync(() => reducer([op], {}), {
    message: 'err',
  });
});

test('rethrow a thrown nested reference error', async (t) => {
  const op = async () => {
    const doTheThing = () => {
      // @ts-ignore
      unknown.doTheThing();
    };

    doTheThing();
  };

  await t.throwsAsync(() => reducer([op], {}), {
    name: 'ReferenceError',
    message: 'unknown is not defined',
  });
});

test('rethrow a thrown nested reference error in a promise', async (t) => {
  const op = () =>
    new Promise(() => {
      const doTheThing = () => {
        // @ts-ignore
        unknown.doTheThing();
      };

      doTheThing();
    });

  await t.throwsAsync(() => reducer([op], {}), {
    name: 'ReferenceError',
    message: 'unknown is not defined',
  });
});

test('rethrow an illegal function call', async (t) => {
  const op = async (s: any) => {
    s();
  };

  await t.throwsAsync(() => reducer([op], {}), {
    name: 'TypeError',
    message: 's is not a function',
  });
});

test('rethrow an indirect type error', async (t) => {
  const op = (x: any) => {
    return async (_s: any) => x();
  };

  await t.throwsAsync(() => reducer([op('jam')], {}), {
    name: 'TypeError',
    message: 'x is not a function',
  });
});

test('rethrow a job error', async (t) => {
  const op = (x: any) => {
    return async (_s: any) => {
      // Create something that looks like an error thrown from VM code
      const e = new TypeError('x is not a function');
      e.stack = `TypeError: x is not a function
        at vm:module(0)`;
      throw e;
    };
  };

  await t.throwsAsync(() => reducer([op('jam')], {}), {
    name: 'TypeError',
    message: 'x is not a function',
  });
});
