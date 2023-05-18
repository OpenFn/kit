import test from 'ava';
import executePlan from '../src/execute/plan';

import { createMockLogger } from '@openfn/logger';

/* Tests on immutable state objects with immer */
const logger = createMockLogger();

test('result state should be immutable', async (t) => {
  const plan = {
    jobs: [
      {
        expression: [(s) => s],
      },
    ],
  };

  const result = await executePlan(plan, { x: 1 }, { strict: false }, logger);
  t.log(result);
  t.is(result.x, 1);

  t.throws(() => (result.y = 2));
});

test('result state should be deeply immutable', async (t) => {
  const plan = {
    jobs: [
      {
        expression: [(s) => s],
      },
    ],
  };

  const result = await executePlan(
    plan,
    { a: { b: { x: 1 } } },
    { strict: false },
    logger
  );
  t.log(result);
  t.is(result.a.b.x, 1);

  t.throws(() => (result.a.b.y = 2));
});
