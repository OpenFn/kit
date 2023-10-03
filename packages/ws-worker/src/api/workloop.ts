import { CLAIM_ATTEMPT } from '../events';
import tryWithBackoff, { Options } from '../util/try-with-backoff';

import type { CancelablePromise, Channel } from '../types';
import type { Logger } from '@openfn/logger';

import claim from './claim';

// TODO this needs to return some kind of cancel function
const startWorkloop = (
  channel: Channel,
  execute: (attempt: CLAIM_ATTEMPT) => void,
  logger: Logger,
  options: Partial<Pick<Options, 'maxBackoff' | 'timeout'>> = {}
) => {
  let promise: CancelablePromise;
  let cancelled = false;

  const workLoop = () => {
    if (!cancelled) {
      promise = tryWithBackoff(() => claim(channel, execute, logger), {
        timeout: options.timeout,
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
