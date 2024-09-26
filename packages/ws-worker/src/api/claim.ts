import crypto from 'node:crypto';
import * as jose from 'jose';
import { Logger, createMockLogger } from '@openfn/logger';
import { ClaimPayload, ClaimReply } from '@openfn/lexicon/lightning';

import { CLAIM } from '../events';

import type { ServerApp } from '../server';

const mockLogger = createMockLogger();

const verifyToken = async (token: string, publicKey: string) => {
  const key = crypto.createPublicKey(publicKey);

  const { payload } = await jose.jwtVerify(token, key, {
    issuer: 'Lightning',
  });

  if (payload) {
    return true;
  }
};

type ClaimOptions = {
  maxWorkers?: number;
};

const claim = (
  app: ServerApp,
  logger: Logger = mockLogger,
  options: ClaimOptions = {}
) => {
  return new Promise<void>((resolve, reject) => {
    const { maxWorkers = 5 } = options;

    const activeWorkers = Object.keys(app.workflows).length;
    if (activeWorkers >= maxWorkers) {
      // Important: stop the workloop so that we don't try and claim any more
      app.workloop?.stop(`server at capacity (${activeWorkers}/${maxWorkers})`);
      return reject(new Error('Server at capacity'));
    }

    if (!app.queueChannel) {
      logger.debug('skipping claim attempt: websocket unavailable');
      return reject(new Error('No websocket available'));
    }
    logger.debug(`requesting run (capacity ${activeWorkers}/${maxWorkers})`);

    const start = Date.now();
    app.queueChannel
      .push<ClaimPayload>(CLAIM, { demand: 1 })
      .receive('ok', ({ runs }: ClaimReply) => {
        const duration = Date.now() - start;
        logger.debug(
          `claimed ${runs.length} runs in ${duration}ms (${
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

          logger.debug('starting run', run.id);
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
