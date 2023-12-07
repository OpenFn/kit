// bottleneck
// pipeline
// throttle
// fifo
const createThrottler = () => {
  type DeferredFunction = {
    fn: Promise<any>;
    args: any[];
    resolve: (result?: any) => void;
    reject: (error?: any) => void;
  };
  const q: DeferredFunction[] = [];

  let activePromise: Promise<any> | undefined;

  // Add a function to the throttler
  // returns a proxy function
  // when the proxy is invoked, the actual function
  // will get called only if no other work is in progress
  const add = (fn: (...args: any[]) => Promise<any>) => {
    return (...args: any[]) => call(fn, args);
  };

  const call = (fn: Promise<any>, args: any[]) => {
    return new Promise((resolve, reject) => {
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

  return add;
};

export default createThrottler;
