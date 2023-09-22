export const wait = (fn, maxAttempts = 100) =>
  new Promise((resolve) => {
    let count = 0;
    let ival = setInterval(() => {
      count++;
      const result = fn() || true;
      if (result) {
        clearInterval(ival);
        resolve(result);
      }

      if (count == maxAttempts) {
        clearInterval(ival);
        resolve();
      }
    }, 100);
  });

export const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const waitForEvent = <T>(rtm, eventName) =>
  new Promise<T>((resolve) => {
    rtm.once(eventName, (e) => {
      resolve(e);
    });
  });

export const sleep = (delay = 100) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay);
  });

export const mockChannel = (callbacks = {}) => {
  const c = {
    on: (event, fn) => {
      // TODO support multiple callbacks
      callbacks[event] = fn;
    },
    push: (event: string, payload?: any) => {
      // if a callback was registered, trigger it
      // otherwise do nothing
      let result;
      if (callbacks[event]) {
        result = callbacks[event](payload);
      }

      return {
        receive: (status, callback) => {
          // TODO maybe do this asynchronously?
          callback(result);
        },
      };
    },
    join: () => {
      return {
        receive: (status, callback) => {
          callback();
        },
      };
    },
  };
  return c;
};

export const mockSocket = () => {
  const channels = {};
  return {
    connect: () => {
      // noop
      // TODO maybe it'd be helpful to throw if the channel isn't connected?
    },
    channel: (topic: string) => {
      channels[topic] = mockChannel();
      return channels[topic];
    },
  };
};
