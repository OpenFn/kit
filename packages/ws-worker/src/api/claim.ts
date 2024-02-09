import * as jose from 'jose';
import { Logger, createMockLogger } from '@openfn/logger';
import { ClaimPayload, ClaimReply } from '@openfn/lexicon/lightning';
import { CLAIM } from '../events';

import type { ServerApp } from '../server';

import { KeyObject } from 'node:crypto';

const mockLogger = createMockLogger();

const verifyToken = async (token: string, secret: string) => {
  console.log(' >>> VERIFY TOKEN');
  console.log('secret:', secret);
  console.log('token:', token);
  // TODO encode this further upstream
  // We should encode the same secret once at use it for both channels
  const encodedSecret = new TextEncoder().encode(secret || '');

  const keyObject = KeyObject.from(secret);
  const { payload } = await jose.jwtVerify(token, keyObject);
  console.log(payload);
  if (payload) {
    return true;
  }
  // TODO we probably need to kill the worker at this point?
  // We also need to un-claim the token, which we have no mechanism for
  console.error('>> INVALID SECRET');
  process.exit(1);
  throw new Error('invalid_secret');
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
            // TODO need to verify the token here right
            // if we fail we need to unclaim somehow?
            // or send a message back?
            // maybe for now we'll process.exit
            await verifyToken(run.token, secret);
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
