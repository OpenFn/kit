import { getHeapStatistics } from 'node:v8';

/**
 * Utility to profile memory usage
 * Will constantly poll memory until stopped and
 * then return the max tracked heap
 */
const profiler = (pollrate = 10) => {
  let peak = -1;

  let interval: NodeJS.Timeout;

  const test = () => {
    const now = getHeapStatistics().used_heap_size;
    console.log(now);
    peak = Math.max(peak, now);
  };
  return {
    start: () => {
      interval = setInterval(test, pollrate);
    },
    stop: () => {
      clearInterval(interval);
      // Make one final test now that we've stopped
      test();
      return peak;
    },
    peak: () => peak,
  };
};

export default profiler;
