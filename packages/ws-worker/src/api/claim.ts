import * as Sentry from '@sentry/node';
import crypto from 'node:crypto';
import * as jose from 'jose';

import { Logger, createMockLogger } from '@openfn/logger';
import { ClaimPayload, ClaimReply } from '@openfn/lexicon/lightning';
import { CLAIM } from '../events';

import type { ServerApp } from '../server';

const mockLogger = createMockLogger();

export const verifyToken = async (token: string, publicKey: string) => {
  const key = crypto.createPublicKey(publicKey);
  const { payload } = await jose.jwtVerify(token, key, {
    issuer: 'Lightning',
    clockTolerance: '5s', // Allow 5 seconds of clock skew
  });

  if (payload) {
    return true;
  }
};

type ClaimOptions = {
  maxWorkers?: number;
};

// used to report the pod name in logging, for tracking
const { DEPLOYED_POD_NAME, WORKER_NAME } = process.env;
const NAME = WORKER_NAME || DEPLOYED_POD_NAME;

class ClaimError extends Error {
  // This breaks the parenting backoff loop
  abort = true;
  constructor(e: string) {
    super(e);
  }
}

const claim = (
  app: ServerApp,
  logger: Logger = mockLogger,
  options: ClaimOptions = {}
) => {
  return new Promise<void>((resolve, reject) => {
    const { maxWorkers = 5 } = options;
    const podName = NAME ? `[${NAME}] ` : '';

    const activeWorkers = Object.keys(app.workflows).length;

    if (activeWorkers >= maxWorkers) {
      // Important: stop the workloop so that we don't try and claim any more
      app.workloop?.stop(`server at capacity (${activeWorkers}/${maxWorkers})`);
      return reject(new ClaimError('Server at capacity'));
    }
    // TODO if activeWorkers + activeClaims > capacity, silently abort
    // This can happen in response to the work-available event

    if (!app.queueChannel) {
      logger.warn('skipping claim attempt: websocket unavailable');
      return reject(new ClaimError('No websocket available'));
    }

    if (app.queueChannel.state === 'closed') {
      // Trying to claim while the channel is closed? That's an error!
      const e = new ClaimError('queue closed');
      Sentry.captureException(e);
      logger.warn('skipping claim attempt: channel closed');
      return reject(e);
    }

    logger.debug(`requesting run (capacity ${activeWorkers}/${maxWorkers})`);

    const start = Date.now();
    app.queueChannel
      .push<ClaimPayload>(CLAIM, {
        demand: 1,
        worker_name: NAME || null,
      })
      .receive('ok', ({ runs }: ClaimReply) => {
        const duration = Date.now() - start;
        logger.debug(
          `${podName}claimed ${runs.length} runs in ${duration}ms (${
            runs.length ? runs.map((r) => r.id).join(',') : '-'
          })`
        );
        // TODO what if we get here after we've been cancelled?
        // the events have already been claimed...

        if (!runs?.length) {
          // throw to backoff and try again
          return reject(new Error('No runs returned'));
        }

        runs.forEach(async (run) => {
          if (app.options?.runPublicKey) {
            try {
              await verifyToken(run.token, app.options.runPublicKey);
              logger.debug('verified run token for', run.id);
            } catch (e) {
              logger.error('Error validating run token');
              logger.error(e);
              reject();
              app.destroy();
              return;
            }
          } else {
            logger.debug('skipping run token validation for', run.id);
          }

          logger.debug(`${podName} starting run ${run.id}`);
          app.execute(run);
          resolve();
        });
      })
      // TODO need implementations for both of these really
      // What do we do if we fail to join the worker channel?
      .receive('error', (e) => {
        logger.error('Error on claim', e);
      })
      .receive('timeout', () => {
        logger.error('TIMEOUT on claim. Runs may be lost.');
        reject(new Error('timeout'));
      });
  });
};

export default claim;
