import * as jose from 'jose';
import { Logger, createMockLogger } from '@openfn/logger';
import { ClaimPayload, ClaimReply } from '@openfn/lexicon/lightning';
import { CLAIM } from '../events';

import type { ServerApp } from '../server';

import crypto from 'node:crypto';

const mockLogger = createMockLogger();

// TODO rename to WORKER_LIGHTNING_PUBLIC_KEY
const DECODED_PUBLIC_KEY = Buffer.from(
  process.env.LIGHTNING_PUBLIC_KEY!,
  'base64'
).toString();

const verifyToken = async (token: string, publicKey: string) => {
  // Create a KeyObject with the public key in
  const key = crypto.createPublicKey(publicKey);

  // Now verify the token against the key
  // This will throw if there's any problen
  const { payload } = await jose.jwtVerify(token, key, {
    issuer: 'Lightning',
  });

  if (payload) {
    return true;
  }
};

type ClaimOptions = {
  secret?: string;
  maxWorkers?: number;
};

// TODO: this needs standalone unit tests now that it's bene moved
const claim = (
  app: ServerApp,
  logger: Logger = mockLogger,
  options: ClaimOptions = {}
) => {
  return new Promise<void>((resolve, reject) => {
    const { secret, maxWorkers = 5 } = options;

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

        runs.forEach(async (run) => {
          if (secret) {
            await verifyToken(run.token, DECODED_PUBLIC_KEY);
          }
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
