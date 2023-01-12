// This job takes a random number of seconds and returns a random number
// import { fn } from '@openfn/language-common';

// Note: since the linker no longer uses node resolution for import, common is unavailable
// to the run-time manager. We basically need to add repo support.
// For now, this simulates the behaviour well enough
const fn = (f) => f;

fn(
  (state) =>
    new Promise((resolve) => {
      const done = () => {
        resolve({ data: { result: Math.random() * 100 } });
      };
      const delay = state && state.configuration && state.configuration.delay;
      setTimeout(done, delay || 500);
    })
);
