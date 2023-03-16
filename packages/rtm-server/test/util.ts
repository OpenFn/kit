export const wait = (fn, maxAttempts = 100) =>
  new Promise((resolve) => {
    let count = 0;
    let ival = setInterval(() => {
      count++;
      if (fn()) {
        clearInterval(ival);
        resolve(true);
      }

      if (count == maxAttempts) {
        clearInterval(ival);
        resolve(false);
      }
    }, 100);
  });
