import test from 'ava';
import Manager from '../src/Manager';

// test('Should create a new manager', (t) => {
//   const m = Manager();
//   t.assert(m);
//   t.assert(m.run);
// });

// test('Should register a job', (t) => {
//   const m = Manager();
//   m.registerJob('my_job', 'x');
//   t.assert(m);
// });

// test('Should throw if registering a job that already exists', (t) => {
//   const m = Manager();
//   m.registerJob('my_job', 'x');
//   t.throws(() => m.registerJob('my_job', 'x'));
// });

// test('Should return a registered job list', (t) => {
//   const m = Manager();
//   m.registerJob('my_job', 'x');
//   m.registerJob('my_other_job', 'x');

//   t.deepEqual(m.getRegisteredJobs(), ['my_job', 'my_other_job']);
// });

test('Should run a simple job', async (t) => {
  const m = Manager();
  m.registerJob('test', 'export default [() => 10];');
  const result = await m.run('test');
  // @ts-ignore
  t.assert(result === 10);
});

// should publish an event when a job starts
// should publish an event when a job stops
// should return a job list
// should return a list of active jobs