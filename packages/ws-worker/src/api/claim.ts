import { Logger, createMockLogger } from '@openfn/logger';
import { CLAIM, ClaimPayload, ClaimReply } from '../events';

import type { ServerApp } from '../server';

const mockLogger = createMockLogger();

// TODO: this needs standalone unit tests now that it's bene moved
const claim = (app: ServerApp, logger: Logger = mockLogger, maxWorkers = 5) => {
  return new Promise<void>((resolve, reject) => {
    const activeWorkers = Object.keys(app.workflows).length;
    if (activeWorkers >= maxWorkers) {
      return reject(new Error('Server at capacity'));
    }

    if (!app.queueChannel) {
      return reject(new Error('No websocket available'));
    }

    logger.debug('requesting run...');
    app.queueChannel
      .push<ClaimPayload>(CLAIM, { demand: 1 })
      .receive('ok', ({ runs }: ClaimReply) => {
        logger.debug(`pulled ${runs.length} runs`);
        // TODO what if we get here after we've been cancelled?
        // the events have already been claimed...

        if (!runs?.length) {
          // throw to backoff and try again
          return reject(new Error('No runs returned'));
        }

        runs.forEach((run) => {
          logger.debug('starting run', run.id);
          app.execute(run);
          resolve();
        });
      })
      // TODO need implementations for both of these really
      // What do we do if we fail to join the worker channel?
      .receive('error', () => {
        logger.debug('pull err');
      })
      .receive('timeout', () => {
        logger.debug('pull timeout');
        reject(new Error('timeout'));
      });
  });
};

export default claim;
