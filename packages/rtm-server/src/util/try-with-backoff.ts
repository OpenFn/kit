// re-usable function which will try a thing repeatedly
// TODO take a timeout

type Options = {
  attempts?: number;
  maxAttempts?: number;
  maxBackoff?: number;
  timeout?: number;
};

// what is the API to this?
// Function should throw if it fails
// but in the main work loop it's not reall a fail for no work
// And we should back off
// under what circumstance should this function throw?
// If it timesout
// Can the inner function force a throw? An exit early?
const tryWithBackoff = (fn, opts: Options = {}) => {
  if (!opts.timeout) {
    opts.timeout = 100; // TODO errors occur if this is too low?
  }
  if (!opts.attempts) {
    opts.attempts = 1;
  }
  let { timeout, attempts, maxAttempts } = opts;
  timeout = timeout || 1;
  attempts = attempts || 1;

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
          timeout: timeout * 2,
        };
        tryWithBackoff(fn, nextOpts).then(resolve).catch(reject);
      }, timeout);
    }
  });
};

export default tryWithBackoff;
