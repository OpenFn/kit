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

  const convertToMb = (mem: number) =>
    Math.round((mem / 1024 / 1024) * 100) / 100;

  return {
    start: () => {
      interval = setInterval(test, pollrate);
    },
    stop: (toMb = false) => {
      clearInterval(interval);
      // Make one final test now that we've stopped
      test();
      return toMb ? convertToMb(peak) : peak;
    },
    peak: () => peak,
    toMb: convertToMb,
  };
};

export default profiler;
