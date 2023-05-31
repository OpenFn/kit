import test from 'ava';
import Manager from '../src/rtm';

test('Should create a new manager', (t) => {
  const m = Manager();
  t.assert(m);
  t.assert(m.run);
});

test('Should register a job', (t) => {
  const m = Manager();
  m.registerJob('my_job', 'x');
  t.assert(m.getRegisteredJobs().includes('my_job'));
});

test('Should compile a registered job', (t) => {
  const m = Manager();
  m.registerJob('my_job', 'fn()');

  const compiled = m._registry['my_job'];
  t.assert(compiled === 'export default [fn()];');
});

test('Should throw if registering a job that already exists', (t) => {
  const m = Manager();
  m.registerJob('my_job', 'x');
  t.throws(() => m.registerJob('my_job', 'x'));
});

test('Should return a registered job list', (t) => {
  const m = Manager();
  m.registerJob('my_job', 'x');
  m.registerJob('my_other_job', 'x');

  t.deepEqual(m.getRegisteredJobs(), ['my_job', 'my_other_job']);
});

test('Should run a mock job with a simple return value', async (t) => {
  // This uses the mock worker, not the actual runtime
  // It will still exercise all the lifecycle logic found in the worker-helper,
  // Just not the runtime logic
  const m = Manager(true);
  m.registerJob('test', 'mock');
  const { result } = await m.run('test', { returnValue: 111 });
  t.assert(result === 111);
});

// should publish an event when a job starts
// should publish an event when a job stops
// should return a job list
// should return a list of active jobs
