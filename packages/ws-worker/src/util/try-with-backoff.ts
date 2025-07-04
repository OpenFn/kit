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
    // Keep the top-level cancel flag in scope
    // This way nested promises will still use the same flag and let
    // themselves be cancelled
    opts.isCancelled = () => cancelled;
  }

  const promise = new Promise<void>(async (resolve, reject) => {
    try {
      await fn();
      resolve();
    } catch (e: any) {
      if (e?.abort) {
        cancelled = true;
        return reject();
      }

      if (opts.isCancelled!()) {
        return resolve();
      }

      if (!isNaN(maxRuns as any) && runs >= (maxRuns as number)) {
        return reject(new Error('max runs exceeded'));
      }
      // failed? No problem, we'll back off and try again
      setTimeout(() => {
        if (opts.isCancelled!()) {
          return resolve();
        }
        const nextOpts = {
          maxRuns,
          runs: runs + 1,
          min: Math.min(max, min * BACKOFF_MULTIPLIER),
          max: max,
          isCancelled: opts.isCancelled,
        };
        //console.log('trying again in ', nextOpts.min);
        tryWithBackoff(fn, nextOpts).then(resolve).catch(reject);
      }, min);
    }
  });

  // allow the try to be cancelled
  // We can't cancel the active in-flight promise but we can prevent the callback
  (promise as CancelablePromise).cancel = () => {
    cancelled = true;
  };

  return promise as CancelablePromise;
};

export default tryWithBackoff;
