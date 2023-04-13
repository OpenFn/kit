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
    start: 'a',
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
    start: 'a',
    start: 'a',
    jobs: {
      a: {
        next: { b: true },
        start: 'a',
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
    start: 'a',
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
    start: 'a',
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

test('throws for no start', (t) => {
  const plan: any = {
    jobs: {
      a: {},
    },
  };
  t.throws(() => validate(plan), {
    message: 'No start job defined',
  });
});

test('throws for invalid string start', (t) => {
  const plan: any = {
    start: 'z',
    jobs: {
      a: {},
    },
  };
  t.throws(() => validate(plan), {
    message: 'Could not find start job: z',
  });
});

test('throws for invalid start', (t) => {
  const plan: any = {
    start: { a: true, z: true },
    jobs: {
      a: {},
    },
  };
  t.throws(() => validate(plan), {
    message: 'Could not find start job: z',
  });
});
