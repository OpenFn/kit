type ThrottledFunction = (...args: any[]) => Promise<any>;

const createThrottler = () => {
  type DeferredFunction = {
    fn: ThrottledFunction;
    args: any[];
    resolve: (result?: any) => void;
    reject: (error?: any) => void;
  };
  const q: DeferredFunction[] = [];

  let activePromise: Promise<any> | undefined;

  // Adds a function to the throttler
  // Only one function in the same throttler can be active at once,
  // Others are deferred onto a queue
  // Returns a wrapped, throttled function
  const add = (fn: ThrottledFunction) => {
    // Return a wrapped function
    return (...args: any[]) =>
      // the wrapped function is a deferred promise
      // that will reject or resolve as usual
      new Promise((resolve, reject) => {
        q.push({ fn, args, resolve, reject });
        shift();
      });
  };

  const shift = () => {
    if (activePromise) {
      return;
    }

    const next = q.shift();
    if (next) {
      const { fn, args, resolve, reject } = next;
      activePromise = fn(...args)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activePromise = undefined;
          shift();
        });
    }
  };

  // TODO add a cancel function, enabling the
  // queue to be struck off if something goes wrong

  return add;
};

export default createThrottler;
