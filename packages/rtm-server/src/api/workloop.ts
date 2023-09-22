import { CLAIM } from '../events';
import { CancelablePromise } from '../types';
import tryWithBackoff from '../util/try-with-backoff';

// TODO this needs to return some kind of cancel function
const startWorkloop = (channel, execute, delay = 100) => {
  let promise: CancelablePromise;
  let cancelled = false;

  const request = () => {
    channel.push(CLAIM).receive('ok', (attempts) => {
      if (!attempts.length) {
        // throw to backoff and try again
        throw new Error('backoff');
      }
      attempts.forEach((attempt) => {
        execute(attempt);
      });
    });
  };

  const workLoop = () => {
    if (!cancelled) {
      promise = tryWithBackoff(request, { timeout: delay });
    }
  };
  workLoop();

  return () => {
    cancelled = true;
    promise.cancel();
  };
};

export default startWorkloop;
