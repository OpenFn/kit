import test from 'ava';
import parseQueues, { QueuesValidationError, createRuntimeGroup } from '../../src/util/parse-queues';

// Happy paths

test('parse "*:5" into a single wildcard group', (t) => {
  const result = parseQueues('*:5');
  t.deepEqual(result, [{ queues: ['*'], maxSlots: 5 }]);
});

test('parse "manual,*:3" into a single group with preference chain', (t) => {
  const result = parseQueues('manual,*:3');
  t.deepEqual(result, [{ queues: ['manual', '*'], maxSlots: 3 }]);
});

test('parse "fast_lane:1 manual,*:4" into two groups', (t) => {
  const result = parseQueues('fast_lane:1 manual,*:4');
  t.deepEqual(result, [
    { queues: ['fast_lane'], maxSlots: 1 },
    { queues: ['manual', '*'], maxSlots: 4 },
  ]);
});

test('parse multi-preference chain "fast_lane,manual,*:1 *:4"', (t) => {
  const result = parseQueues('fast_lane,manual,*:1 *:4');
  t.deepEqual(result, [
    { queues: ['fast_lane', 'manual', '*'], maxSlots: 1 },
    { queues: ['*'], maxSlots: 4 },
  ]);
});

test('parse single non-wildcard group "my_queue:10"', (t) => {
  const result = parseQueues('my_queue:10');
  t.deepEqual(result, [{ queues: ['my_queue'], maxSlots: 10 }]);
});

test('tolerate extra whitespace', (t) => {
  const result = parseQueues('  a:1   b:2  ');
  t.deepEqual(result, [
    { queues: ['a'], maxSlots: 1 },
    { queues: ['b'], maxSlots: 2 },
  ]);
});

// Validation errors

test('throw on empty string', (t) => {
  const err = t.throws(() => parseQueues(''), {
    instanceOf: QueuesValidationError,
  });
  t.truthy(err?.message);
});

test('throw on whitespace-only string', (t) => {
  t.throws(() => parseQueues('   '), { instanceOf: QueuesValidationError });
});

test('throw when missing count "manual,*"', (t) => {
  t.throws(() => parseQueues('manual,*'), {
    instanceOf: QueuesValidationError,
  });
});

test('throw on count zero "*:0"', (t) => {
  t.throws(() => parseQueues('*:0'), { instanceOf: QueuesValidationError });
});

test('throw on negative count "*:-1"', (t) => {
  t.throws(() => parseQueues('*:-1'), { instanceOf: QueuesValidationError });
});

test('throw on non-integer count "*:1.5"', (t) => {
  t.throws(() => parseQueues('*:1.5'), { instanceOf: QueuesValidationError });
});

test('throw on non-numeric count "*:abc"', (t) => {
  t.throws(() => parseQueues('*:abc'), { instanceOf: QueuesValidationError });
});

test('throw when wildcard is not last "*,manual:1"', (t) => {
  t.throws(() => parseQueues('*,manual:1'), {
    instanceOf: QueuesValidationError,
  });
});

test('throw when wildcard is in the middle "a,*,b:1"', (t) => {
  t.throws(() => parseQueues('a,*,b:1'), {
    instanceOf: QueuesValidationError,
  });
});

test('throw on invalid name chars "my-queue:1"', (t) => {
  t.throws(() => parseQueues('my-queue:1'), {
    instanceOf: QueuesValidationError,
  });
});

test('throw on invalid name chars "a@b:1"', (t) => {
  t.throws(() => parseQueues('a@b:1'), { instanceOf: QueuesValidationError });
});

test('throw on empty name from double comma "a,,b:1"', (t) => {
  t.throws(() => parseQueues('a,,b:1'), { instanceOf: QueuesValidationError });
});

// createRuntimeGroup tests

test('createRuntimeGroup: generates correct id', (t) => {
  const group = createRuntimeGroup({ queues: ['fast_lane'], maxSlots: 1 });
  t.is(group.id, 'fast_lane:1');
});

test('createRuntimeGroup: generates id with multiple queues', (t) => {
  const group = createRuntimeGroup({ queues: ['manual', '*'], maxSlots: 4 });
  t.is(group.id, 'manual,*:4');
});

test('createRuntimeGroup: initializes empty activeRuns', (t) => {
  const group = createRuntimeGroup({ queues: ['*'], maxSlots: 5 });
  t.is(group.activeRuns.size, 0);
});

test('createRuntimeGroup: initializes empty openClaims', (t) => {
  const group = createRuntimeGroup({ queues: ['*'], maxSlots: 5 });
  t.deepEqual(group.openClaims, {});
});

test('createRuntimeGroup: initializes null workloop', (t) => {
  const group = createRuntimeGroup({ queues: ['*'], maxSlots: 5 });
  t.is(group.workloop, null);
});

test('createRuntimeGroup: preserves queues and maxSlots', (t) => {
  const group = createRuntimeGroup({ queues: ['a', 'b', '*'], maxSlots: 3 });
  t.deepEqual(group.queues, ['a', 'b', '*']);
  t.is(group.maxSlots, 3);
});
