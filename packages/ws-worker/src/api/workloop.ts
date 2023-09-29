import type { Logger } from '@openfn/logger';
import { CLAIM, CLAIM_ATTEMPT, CLAIM_PAYLOAD, CLAIM_REPLY } from '../events';
import tryWithBackoff, { Options } from '../util/try-with-backoff';

import type { CancelablePromise, Channel } from '../types';

// TODO this needs to return some kind of cancel function
const startWorkloop = (
  channel: Channel,
  execute: (attempt: CLAIM_ATTEMPT) => void,
  logger: Logger,
  options: Partial<Pick<Options, 'maxBackoff' | 'timeout'>> = {}
) => {
  let promise: CancelablePromise;
  let cancelled = false;

  const request = () => {
    return new Promise<void>((resolve, reject) => {
      logger.debug('pull claim');
      channel
        .push<CLAIM_PAYLOAD>(CLAIM, { demand: 1 })
        .receive('ok', (attempts: CLAIM_REPLY) => {
          // TODO what if we get here after we've been cancelled?
          // the events have already been claimed...

          if (!attempts?.length) {
            logger.debug('no attempts, backing off');
            // throw to backoff and try again
            return reject(new Error('backoff'));
          }

          attempts.forEach((attempt) => {
            logger.debug('starting attempt', attempt.id);
            execute(attempt);
            resolve();
          });
        });
    });
  };

  const workLoop = () => {
    if (!cancelled) {
      promise = tryWithBackoff(request, {
        timeout: options.delay,
        maxBackoff: options.maxBackoff,
      });
      // TODO this needs more unit tests I think
      promise.then(() => {
        if (!cancelled) {
          workLoop();
        }
      });
    }
  };
  workLoop();

  return () => {
    logger.debug('cancelling workloop');
    cancelled = true;
    promise.cancel();
  };
};

export default startWorkloop;
