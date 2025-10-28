import test from 'ava';
import profiler from '../../src/util/profile-memory';

test('profiler tracks peak memory usage', async (t) => {
  const memProfiler = profiler(10);

  memProfiler.start();

  t.is(memProfiler.peak(), -1);

  // Simulate some memory usage
  const a = new Array(1e6).fill(1);

  // Wait for polling to capture memory usage
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Stop profiling and get peak
  const peak = memProfiler.stop();

  // Peak should be greater than 0
  t.true(peak > 0, 'Peak memory should be greater than 0');
});

test('profiler accepts custom poll rate', async (t) => {
  const customPollRate = 100;
  const memProfiler = profiler(customPollRate);

  memProfiler.start();

  t.is(memProfiler.peak(), -1);

  await new Promise((resolve) => setTimeout(resolve, 50));

  // should not have tracked yet
  t.is(memProfiler.peak(), -1);

  // wait a bti more
  await new Promise((resolve) => setTimeout(resolve, 100));

  const peak = memProfiler.stop();

  t.true(memProfiler.peak() > 0);

  // Should have tracked some memory
  t.true(peak > 0, 'Should track memory with custom poll rate');
});

test('profiler tracks on stop', async (t) => {
  const memProfiler = profiler(10000); // will never trigger!

  memProfiler.start();

  t.is(memProfiler.peak(), -1);

  const peak = memProfiler.stop();
  t.true(peak > 0, 'Peak memory should be greater than 0');
  t.true(peak > 1000, 'Peak memory should be greater than 1000');
});

test('profiler converts the result to mb', async (t) => {
  const memProfiler = profiler(10000); // will never trigger!

  memProfiler.start();

  t.is(memProfiler.peak(), -1);

  const peak = memProfiler.stop(true);
  t.log(peak);
  t.true(peak > 0, 'Peak memory should be greater than 0');
  t.true(peak < 50, 'Peak memory should be less than 50');
});

test('profiler mb converts 1 mb exactly', async (t) => {
  const memProfiler = profiler(10000);

  const result = memProfiler.toMb(1024 * 1024);
  t.is(result, 1);
});

test('profiler mb converts 1.5 mb exactly', async (t) => {
  const memProfiler = profiler(10000);

  const result = memProfiler.toMb(1572864);
  t.is(result, 1.5);
});
