// bottleneck
// pipeline
// throttle

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
      // if (activePromise) {
      // } else {
      //   activePromise = fn(...args).then(shift);
      // }
    });

    // const promise = new Promise((resolve) => {
    //   // note I don't want this to execute immediately!!
    //   fn(args).then(resolve);
    // });

    // // is it better to chain to the promise?
    // if (activePromise) {
    //   q.push([fn, args]);
    // } else {
    //   activePromise = fn(...args).then(shift);
    // }
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

  return {
    add,
  };
};

export default createThrottler;

// // executes functions in series
// // Any functions in the same

// // returns a function
// // the function will execute in series

// // What if a throw?

// const createQueue = () => {
//   // a queue of functions to execute
//   const q = [];

//   const add = (fn) => {
//     return (...args) => {
//       queue.push([fn, args]);
//       shift();
//     };
//   };

//   const shift = async () => {
//     const [fn, args] = q.shift();

//     await fn(args);

//     shift();
//   };

//   return {};
// };

// const queue = () => {};
