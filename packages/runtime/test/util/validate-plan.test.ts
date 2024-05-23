import test from 'ava';
import type { ExecutionPlan, Job } from '@openfn/lexicon';

import validate, { buildModel } from '../../src/util/validate-plan';
import { createMockLogger } from '@openfn/logger';

const job = (id: string, next?: Record<string, boolean>) =>
({
  id,
  next,
  expression: '.',
} as Job);

const logger = createMockLogger(undefined, { json: true });

test.afterEach(() => {
  logger._reset();
});

test('builds a simple model', (t) => {
  const plan: ExecutionPlan = {
    options: {},
    workflow: {
      steps: [job('a', { b: true }), job('b')],
    },
  };

  const model = buildModel(plan);
  t.deepEqual(model, {
    a: {
      down: { b: true },
      up: {},
    },
    b: {
      down: {},
      up: { a: true },
    },
  });
});

test('builds a more complex model', (t) => {
  const plan: ExecutionPlan = {
    options: {},
    workflow: {
      steps: [job('a', { b: true }), job('b', { c: true, a: true }), job('c')],
    },
  };

  const model = buildModel(plan);
  t.deepEqual(model, {
    a: {
      down: { b: true },
      up: { b: true },
    },
    b: {
      down: { c: true, a: true },
      up: { a: true },
    },
    c: {
      up: { b: true },
      down: {},
    },
  });
});

test('throws for a circular dependency', (t) => {
  const plan: ExecutionPlan = {
    options: {},
    workflow: {
      steps: [job('a', { b: true }), job('b', { a: true })],
    },
  };

  t.throws(() => validate(plan, logger), {
    message: 'Circular dependency: b <-> a',
  });
});

test('throws for an indirect circular dependency', (t) => {
  const plan: ExecutionPlan = {
    options: {},
    workflow: {
      steps: [
        job('a', { b: true }),
        job('b', { c: true }),
        job('c', { a: true }),
      ],
    },
  };

  t.throws(() => validate(plan, logger), {
    message: 'Circular dependency: c <-> a',
  });
});

test('throws for a multiple inputs', (t) => {
  const plan: ExecutionPlan = {
    options: {},
    workflow: {
      steps: [
        job('a', { b: true, c: true }),
        job('b', { z: true }),
        job('c', { z: true }),
        job('z'),
      ],
    },
  };

  t.throws(() => validate(plan, logger), {
    message: 'Multiple dependencies detected for: z',
  });
});

test('throws for a an unknown job', (t) => {
  const plan: ExecutionPlan = {
    options: {},
    workflow: {
      steps: [job('next', { z: true })],
    },
  };

  t.throws(() => validate(plan, logger), {
    message: 'Cannot find job: z',
  });
});

test('throws for a an unknown job with shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    options: {},
    workflow: {
      steps: [
        {
          next: 'z',
          expression: '.',
        },
      ],
    },
  };
  t.throws(() => validate(plan, logger), {
    message: 'Cannot find job: z',
  });
});

test('throws for invalid string start', (t) => {
  const plan: ExecutionPlan = {
    options: {
      start: 'z',
    },
    workflow: {
      steps: [job('a')],
    },
  };

  t.throws(() => validate(plan, logger), {
    message: 'Could not find start job: z',
  });
});

test('throws for missing workflow', (t) => {
  //@ts-ignore
  const plan: ExecutionPlan = {
    options: {
      start: 'a',
    }
  };

  t.throws(() => validate(plan, logger), {
    message: 'Missing or invalid workflow key in execution plan',
  });
});

test('throws for adaptor without an expression', (t) => {
  const plan: ExecutionPlan = {
    options: {
      start: 'a',
    },
    workflow: {
      steps: [
        {
          id: 'a',
          adaptor: 'z'
        }
      ],
    },
  };

  t.throws(() => validate(plan, logger), {
    message: 'Step a with an adaptor must also have an expression',
  });
});

test('throws for unknown key in a step', (t) => {
  const plan: ExecutionPlan = {
    options: {
      start: 'a',
    },
    workflow: {
      steps: [
        {
          id: 'a',
          //@ts-ignore
          key: 'z'
        }
      ],
    },
  };

  t.throws(() => validate(plan, logger), {
    message: 'Invalid key "key" in step a',
  });
});
