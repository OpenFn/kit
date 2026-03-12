import test from 'ava';
import parseWorkloops, {
  WorkloopValidationError,
} from '../../src/util/parse-workloops';

test('parse "*:5" into a single wildcard workloop', (t) => {
  const result = parseWorkloops('*:5');
  t.deepEqual(result, [
    {
      id: '*:5',
      queues: ['*'],
      capacity: 5,
      activeRuns: new Set(),
      openClaims: {},
    },
  ]);
});

test('parse "manual>*:3" into a single workloop with preference chain', (t) => {
  const result = parseWorkloops('manual>*:3');
  t.deepEqual(result, [
    {
      id: 'manual>*:3',
      queues: ['manual', '*'],
      capacity: 3,
      activeRuns: new Set(),
      openClaims: {},
    },
  ]);
});

test('parse "fast_lane:1 manual>*:4" into two workloops', (t) => {
  const result = parseWorkloops('fast_lane:1 manual>*:4');
  t.deepEqual(result, [
    {
      id: 'fast_lane:1',
      queues: ['fast_lane'],
      capacity: 1,
      activeRuns: new Set(),
      openClaims: {},
    },
    {
      id: 'manual>*:4',
      queues: ['manual', '*'],
      capacity: 4,
      activeRuns: new Set(),
      openClaims: {},
    },
  ]);
});

test('parse multi-preference chain "fast_lane>manual>*:1 *:4"', (t) => {
  const result = parseWorkloops('fast_lane>manual>*:1 *:4');
  t.deepEqual(result, [
    {
      id: 'fast_lane>manual>*:1',
      queues: ['fast_lane', 'manual', '*'],
      capacity: 1,
      activeRuns: new Set(),
      openClaims: {},
    },
    {
      id: '*:4',
      queues: ['*'],
      capacity: 4,
      activeRuns: new Set(),
      openClaims: {},
    },
  ]);
});

test('parse single non-wildcard workloop "my_queue:10"', (t) => {
  const result = parseWorkloops('my_queue:10');
  t.deepEqual(result, [
    {
      id: 'my_queue:10',
      queues: ['my_queue'],
      capacity: 10,
      activeRuns: new Set(),
      openClaims: {},
    },
  ]);
});

test('tolerate extra whitespace', (t) => {
  const result = parseWorkloops('  a:1   b:2  ');
  t.deepEqual(result, [
    {
      id: 'a:1',
      queues: ['a'],
      capacity: 1,
      activeRuns: new Set(),
      openClaims: {},
    },
    {
      id: 'b:2',
      queues: ['b'],
      capacity: 2,
      activeRuns: new Set(),
      openClaims: {},
    },
  ]);
});

test('throw on empty string', (t) => {
  const err = t.throws(() => parseWorkloops(''), {
    instanceOf: WorkloopValidationError,
  });
  t.truthy(err?.message);
});

test('throw on whitespace-only string', (t) => {
  t.throws(() => parseWorkloops('   '), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw when missing count "manual>*"', (t) => {
  t.throws(() => parseWorkloops('manual>*'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw on count zero "*:0"', (t) => {
  t.throws(() => parseWorkloops('*:0'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw on negative count "*:-1"', (t) => {
  t.throws(() => parseWorkloops('*:-1'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw on non-integer count "*:1.5"', (t) => {
  t.throws(() => parseWorkloops('*:1.5'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw on non-numeric count "*:abc"', (t) => {
  t.throws(() => parseWorkloops('*:abc'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw when wildcard is not last "*>manual:1"', (t) => {
  t.throws(() => parseWorkloops('*>manual:1'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw when wildcard is in the middle "a>*>b:1"', (t) => {
  t.throws(() => parseWorkloops('a>*>b:1'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw on invalid name chars "my-queue:1"', (t) => {
  t.throws(() => parseWorkloops('my-queue:1'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw on invalid name chars "a@b:1"', (t) => {
  t.throws(() => parseWorkloops('a@b:1'), {
    instanceOf: WorkloopValidationError,
  });
});

test('throw on empty name from double separator "a>>b:1"', (t) => {
  t.throws(() => parseWorkloops('a>>b:1'), {
    instanceOf: WorkloopValidationError,
  });
});
