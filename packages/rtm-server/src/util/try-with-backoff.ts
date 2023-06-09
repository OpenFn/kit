type Options = {
  attempts?: number;
  maxAttempts?: number;
  maxBackoff?: number;
  timeout?: number;
};

const MAX_BACKOFF = 1000 * 60;

// This function will try and call its first argument every {opts.timeout|100}ms
// If the function throws, it will "backoff" and try again a little later
// Right now it's a bit of a sketch, but it sort of works!
const tryWithBackoff = (fn: any, opts: Options = {}) => {
  if (!opts.timeout) {
    opts.timeout = 100;
  }
  if (!opts.attempts) {
    opts.attempts = 1;
  }
  let { timeout, attempts, maxAttempts } = opts;
  timeout = timeout;
  attempts = attempts;

  return new Promise<void>(async (resolve, reject) => {
    try {
      await fn();
      resolve();
    } catch (e) {
      if (!isNaN(maxAttempts as any) && attempts >= (maxAttempts as number)) {
        return reject(new Error('max attempts exceeded'));
      }
      // failed? No problem, we'll back off and try again
      // TODO update opts
      // TODO is this gonna cause a crazy promise chain?
      setTimeout(() => {
        const nextOpts = {
          maxAttempts,
          attempts: attempts + 1,
          timeout: Math.min(MAX_BACKOFF, timeout * 1.2),
        };

        tryWithBackoff(fn, nextOpts).then(resolve).catch(reject);
      }, timeout);
    }
  });
};

export default tryWithBackoff;
