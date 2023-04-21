import test from 'ava';
import { ExecutionPlan } from '../../src';

import validate, { buildModel } from '../../src/util/validate-plan';

test('builds a simple model', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        next: { b: true },
      },
      {
        id: 'b',
      },
    ],
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
    jobs: [
      {
        id: 'a',
        next: { b: true },
      },
      {
        id: 'b',
        next: { c: true, a: true },
      },
      { id: 'c' },
    ],
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
    jobs: [
      {
        id: 'a',
        next: { b: true },
      },
      {
        id: 'b',
        next: { a: true },
      },
    ],
  };

  t.throws(() => validate(plan), {
    message: 'Circular dependency: b <-> a',
  });
});

test('throws for an indirect circular dependency', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        next: { b: true },
      },
      {
        id: 'b',
        next: { c: true },
      },
      {
        id: 'c',
        next: { a: true },
      },
    ],
  };

  t.throws(() => validate(plan), {
    message: 'Circular dependency: c <-> a',
  });
});

test('throws for a multiple inputs', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        id: 'a',
        next: { b: true, c: true },
      },
      {
        id: 'b',
        next: { z: true },
      },
      {
        id: 'c',
        next: { z: true },
      },
      { id: 'z' },
    ],
  };
  t.throws(() => validate(plan), {
    message: 'Multiple dependencies detected for: z',
  });
});

test('throws for a an unknown job', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        next: { z: true },
      },
    ],
  };
  t.throws(() => validate(plan), {
    message: 'Cannot find job: z',
  });
});

test('throws for a an unknown job with shorthand syntax', (t) => {
  const plan: ExecutionPlan = {
    jobs: [
      {
        next: 'z',
      },
    ],
  };
  t.throws(() => validate(plan), {
    message: 'Cannot find job: z',
  });
});

test('throws for invalid string start', (t) => {
  const plan: ExecutionPlan = {
    start: 'z',
    jobs: [{ id: 'a' }],
  };
  t.throws(() => validate(plan), {
    message: 'Could not find start job: z',
  });
});
