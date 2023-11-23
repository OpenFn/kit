import tryWithBackoff from '../util/try-with-backoff';
import claim from './claim';

import type { ServerApp } from '../server';
import type { CancelablePromise } from '../types';
import type { Logger } from '@openfn/logger';

const startWorkloop = (
  app: ServerApp,
  logger: Logger,
  minBackoff: number,
  maxBackoff: number,
  maxWorkers?: number
) => {
  let promise: CancelablePromise;
  let cancelled = false;

  const workLoop = () => {
    if (!cancelled) {
      promise = tryWithBackoff(() => claim(app, logger, maxWorkers), {
        min: minBackoff,
        max: maxBackoff,
      });
      // TODO this needs more unit tests I think
      promise.then(() => {
        if (!cancelled) {
          setTimeout(workLoop, minBackoff);
        }
      });
    }
  };
  workLoop();

  return () => {
    logger.debug('cancelling workloop');
    cancelled = true;
    promise.cancel();
    app.queueChannel?.leave();
  };
};

export default startWorkloop;
