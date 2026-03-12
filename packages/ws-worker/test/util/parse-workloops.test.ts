import test from 'ava';
import parseWorkloops, {
  WorkloopValidationError,
  createWorkloop,
  workloopHasCapacity,
} from '../../src/util/parse-workloops';

// Happy paths

test('parse "*:5" into a single wildcard workloop', (t) => {
  const result = parseWorkloops('*:5');
  t.deepEqual(result, [{ queues: ['*'], capacity: 5 }]);
});

test('parse "manual>*:3" into a single workloop with preference chain', (t) => {
  const result = parseWorkloops('manual>*:3');
  t.deepEqual(result, [{ queues: ['manual', '*'], capacity: 3 }]);
});

test('parse "fast_lane:1 manual>*:4" into two workloops', (t) => {
  const result = parseWorkloops('fast_lane:1 manual>*:4');
  t.deepEqual(result, [
    { queues: ['fast_lane'], capacity: 1 },
    { queues: ['manual', '*'], capacity: 4 },
  ]);
});

test('parse multi-preference chain "fast_lane>manual>*:1 *:4"', (t) => {
  const result = parseWorkloops('fast_lane>manual>*:1 *:4');
  t.deepEqual(result, [
    { queues: ['fast_lane', 'manual', '*'], capacity: 1 },
    { queues: ['*'], capacity: 4 },
  ]);
});

test('parse single non-wildcard workloop "my_queue:10"', (t) => {
  const result = parseWorkloops('my_queue:10');
  t.deepEqual(result, [{ queues: ['my_queue'], capacity: 10 }]);
});

test('tolerate extra whitespace', (t) => {
  const result = parseWorkloops('  a:1   b:2  ');
  t.deepEqual(result, [
    { queues: ['a'], capacity: 1 },
    { queues: ['b'], capacity: 2 },
  ]);
});

// Validation errors

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

// createWorkloop tests

test('createWorkloop: generates correct id', (t) => {
  const workloop = createWorkloop({ queues: ['fast_lane'], capacity: 1 });
  t.is(workloop.id, 'fast_lane:1');
});

test('createWorkloop: generates id with multiple queues', (t) => {
  const workloop = createWorkloop({ queues: ['manual', '*'], capacity: 4 });
  t.is(workloop.id, 'manual>*:4');
});

test('createWorkloop: initializes empty activeRuns', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 5 });
  t.is(workloop.activeRuns.size, 0);
});

test('createWorkloop: initializes empty openClaims', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 5 });
  t.deepEqual(workloop.openClaims, {});
});

test('createWorkloop: initializes stub stop/isStopped', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 5 });
  t.is(typeof workloop.stop, 'function');
  t.is(typeof workloop.isStopped, 'function');
  t.true(workloop.isStopped()); // not started = stopped
});

test('createWorkloop: preserves queues and capacity', (t) => {
  const workloop = createWorkloop({ queues: ['a', 'b', '*'], capacity: 3 });
  t.deepEqual(workloop.queues, ['a', 'b', '*']);
  t.is(workloop.capacity, 3);
});

// workloopHasCapacity tests

test('workloopHasCapacity: has capacity when empty', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 3 });
  t.true(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: has capacity when partially filled', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 3 });
  workloop.activeRuns.add('run-1');
  t.true(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: no capacity when activeRuns fills capacity', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 2 });
  workloop.activeRuns.add('run-1');
  workloop.activeRuns.add('run-2');
  t.false(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: no capacity when pendingClaims fills capacity', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 2 });
  workloop.openClaims['claim-a'] = 2;
  t.false(workloopHasCapacity(workloop));
});

test('workloopHasCapacity: no capacity when activeRuns + pendingClaims fills capacity', (t) => {
  const workloop = createWorkloop({ queues: ['*'], capacity: 3 });
  workloop.activeRuns.add('run-1');
  workloop.openClaims['claim-a'] = 1;
  workloop.openClaims['claim-b'] = 1;
  t.false(workloopHasCapacity(workloop));
});
