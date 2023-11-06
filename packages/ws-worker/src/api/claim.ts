import { Logger, createMockLogger } from '@openfn/logger';
import { CLAIM, CLAIM_ATTEMPT, CLAIM_PAYLOAD, CLAIM_REPLY } from '../events';

import type { Channel } from '../types';

const mockLogger = createMockLogger();

// TODO: this needs standalone unit tests now that it's bene moved
const claim = (
  channel: Channel,
  execute: (attempt: CLAIM_ATTEMPT) => void,
  logger: Logger = mockLogger
) => {
  return new Promise<void>((resolve, reject) => {
    // If the server is at capacity, throw
    // This will increment the timeout duration
    // So a busy server may well hit max timeout while jobs complete
    // A good optimisation here is to reset the workloop or something when the job is complete
    // Or, kill the workloop, listen for the next complete or error event, and restart it
    logger.debug('requesting attempt...');
    channel
      .push<CLAIM_PAYLOAD>(CLAIM, { demand: 1 })
      .receive('ok', ({ attempts }: CLAIM_REPLY) => {
        logger.debug(`pulled ${attempts.length} attempts`);
        // TODO what if we get here after we've been cancelled?
        // the events have already been claimed...

        if (!attempts?.length) {
          // throw to backoff and try again
          return reject(new Error('claim failed'));
        }

        attempts.forEach((attempt) => {
          logger.debug('starting attempt', attempt.id);
          execute(attempt);
          resolve();
        });
      });
    // // TODO need implementations for both of these really
    // // What do we do if we fail to join the worker channel?
    // .receive('error', () => {
    //   logger.debug('pull err');
    // })
    // .receive('timeout', () => {
    //   logger.debug('pull timeout');
    // });
  });
};

export default claim;
