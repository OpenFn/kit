import { CancelablePromise } from '../types';

export type Options = {
  runs?: number;
  maxRuns?: number;

  // min and max durations
  min?: number;
  max?: number;

  // these are provided internally
  timeout?: number;
  isCancelled?: () => boolean;
};

// Rate at which timeouts are increased
const BACKOFF_MULTIPLIER = 1.15;

// This function will try and call its first argument every {opts.timeout|100}ms
// If the function throws, it will "backoff" and try again a little later
// Right now it's a bit of a sketch, but it sort of works!
const tryWithBackoff = (fn: any, opts: Options = {}): CancelablePromise => {
  const { min = 1000, max = 10000, maxRuns, runs = 1 } = opts;

  let cancelled = false;

  if (!opts.isCancelled) {
    opts.isCancelled = () => cancelled;
  }

  const run = async (): Promise<void> => {
    try {
      await fn();
    } catch (e: any) {
      if (e?.abort) {
        cancelled = true;
        throw e;
      }

      if (opts.isCancelled!()) {
        return;
      }

      if (!isNaN(maxRuns as any) && runs >= (maxRuns as number)) {
        throw new Error('max runs exceeded');
      }

      await new Promise<void>((resolve) => setTimeout(resolve, min));

      if (opts.isCancelled!()) {
        return;
      }

      const nextOpts = {
        maxRuns,
        runs: runs + 1,
        min: Math.min(max, min * BACKOFF_MULTIPLIER),
        max: max,
        isCancelled: opts.isCancelled,
      };

      return tryWithBackoff(fn, nextOpts);
    }
  };

  const promise = run() as CancelablePromise;

  promise.cancel = () => {
    cancelled = true;
  };

  return promise;
};

export default tryWithBackoff;
