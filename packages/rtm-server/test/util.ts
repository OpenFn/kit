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
