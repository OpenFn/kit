import test from 'ava';

import validate, { buildModel } from '../../src/util/validate-plan';

test('builds a simple model', (t) => {
  const plan: any = {
    jobs: {
      a: {
        next: { b: true },
      },
      b: {},
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
  const plan: any = {
    jobs: {
      a: {
        next: { b: true },
      },
      b: {
        next: { c: true, a: true },
      },
      c: {},
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
  const plan: any = {
    jobs: {
      a: {
        next: { b: true },
      },
      b: {
        next: { a: true },
      },
    },
  };

  t.throws(() => validate(plan), {
    message: 'Circular dependency: b <-> a',
  });
});

test('throws for an indirect circular dependency', (t) => {
  const plan: any = {
    jobs: {
      a: {
        next: { b: true },
      },
      b: {
        next: { c: true },
      },
      c: {
        next: { a: true },
      },
    },
  };

  t.throws(() => validate(plan), {
    message: 'Circular dependency: c <-> a',
  });
});

test('throws for a multiple inputs', (t) => {
  const plan: any = {
    jobs: {
      start: {
        next: { a: true, b: true },
      },
      a: {
        next: { z: true },
      },
      b: {
        next: { z: true },
      },
      z: {},
    },
  };
  t.throws(() => validate(plan), {
    message: 'Multiple dependencies detected for: z',
  });
});

test('throws for a an unknown job', (t) => {
  const plan: any = {
    jobs: {
      a: {
        next: { z: true },
      },
    },
  };
  t.throws(() => validate(plan), {
    message: 'Cannot find job: z',
  });
});
