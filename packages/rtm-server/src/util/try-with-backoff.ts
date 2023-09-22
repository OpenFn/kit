import { CancelablePromise } from '../types';

type Options = {
  attempts?: number;
  maxAttempts?: number;
  maxBackoff?: number;
  timeout?: number;
  isCancelled?: () => boolean;
};

const MAX_BACKOFF = 1000 * 60;

// This function will try and call its first argument every {opts.timeout|100}ms
// If the function throws, it will "backoff" and try again a little later
// Right now it's a bit of a sketch, but it sort of works!
const tryWithBackoff = (fn: any, opts: Options = {}): CancelablePromise => {
  if (!opts.timeout) {
    opts.timeout = 100;
  }
  if (!opts.attempts) {
    opts.attempts = 1;
  }
  let { timeout, attempts, maxAttempts } = opts;
  timeout = timeout;
  attempts = attempts;

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
    } catch (e) {
      if (opts.isCancelled!()) {
        return resolve();
      }

      if (!isNaN(maxAttempts as any) && attempts >= (maxAttempts as number)) {
        return reject(new Error('max attempts exceeded'));
      }
      // failed? No problem, we'll back off and try again
      setTimeout(() => {
        if (opts.isCancelled!()) {
          return resolve();
        }
        const nextOpts = {
          maxAttempts,
          attempts: attempts + 1,
          timeout: Math.min(MAX_BACKOFF, timeout * 1.2),
          isCancelled: opts.isCancelled,
        };

        tryWithBackoff(fn, nextOpts).then(resolve).catch(reject);
      }, timeout);
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
