import v8 from 'node:v8';
import * as Sentry from '@sentry/node';
import crypto from 'node:crypto';
import * as jose from 'jose';

import { Logger, createMockLogger } from '@openfn/logger';
import { ClaimPayload, ClaimReply } from '@openfn/lexicon/lightning';
import {
  CLAIM,
  INTERNAL_CLAIM_COMPLETE,
  INTERNAL_CLAIM_START,
} from '../events';

import type { ServerApp } from '../server';
import type { Workloop } from './workloop';

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
  demand?: number;
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

let claimIdGen = 0;

export const resetClaimIdGen = () => {
  claimIdGen = 0;
};

const claim = (
  app: ServerApp,
  workloop: Workloop,
  logger: Logger = mockLogger,
  options: ClaimOptions = {}
) => {
  return new Promise<void>((resolve, reject) => {
    const { demand = 1 } = options;
    const podName = NAME ? `[${NAME}] ` : '';

    const activeInWorkloop = workloop.activeRuns.size;
    const capacity = workloop.capacity;

    const pendingWorkloopClaims = Object.values(workloop.openClaims).reduce(
      (a, b) => a + b,
      0
    );

    if (activeInWorkloop >= capacity) {
      workloop.stop(
        `workloop ${workloop.id} at capacity (${activeInWorkloop}/${capacity})`
      );
      return reject(new ClaimError('Workloop at capacity'));
    } else if (activeInWorkloop + pendingWorkloopClaims >= capacity) {
      workloop.stop(
        `workloop ${workloop.id} at capacity (${activeInWorkloop}/${capacity}, ${pendingWorkloopClaims} pending)`
      );
      return reject(new ClaimError('Workloop at capacity'));
    }

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

    const claimId = ++claimIdGen;

    workloop.openClaims[claimId] = demand;

    const { used_heap_size, heap_size_limit } = v8.getHeapStatistics();
    const usedHeapMb = Math.round(used_heap_size / 1024 / 1024);
    const totalHeapMb = Math.round(heap_size_limit / 1024 / 1024);
    const memPercent = Math.round((usedHeapMb / totalHeapMb) * 100);
    logger.debug(
      `Claiming runs [${workloop.id}] :: demand ${demand} | capacity ${activeInWorkloop}/${capacity} | memory ${memPercent}% (${usedHeapMb}/${totalHeapMb}mb)`
    );

    app.events.emit(INTERNAL_CLAIM_START);
    const start = Date.now();
    app.queueChannel
      .push<ClaimPayload>(CLAIM, {
        demand,
        worker_name: NAME || null,
        queues: workloop.queues,
      })
      .receive('ok', async ({ runs }: ClaimReply) => {
        delete workloop.openClaims[claimId];
        const duration = Date.now() - start;
        logger.debug(
          `${podName}claimed ${runs.length} runs in ${duration}ms (${
            runs.length ? runs.map((r) => r.id).join(',') : '-'
          })`
        );

        if (!runs?.length) {
          app.events.emit(INTERNAL_CLAIM_COMPLETE, { runs });
          // throw to backoff and try again
          return reject(new Error('No runs returned'));
        }

        for (const run of runs) {
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

          // Track run in workloop
          workloop.activeRuns.add(run.id);
          app.runWorkloopMap[run.id] = workloop;

          logger.debug(`${podName} starting run ${run.id}`);
          app.execute(run);
        }

        // Don't trigger claim complete until all runs are registered
        resolve();
        app.events.emit(INTERNAL_CLAIM_COMPLETE, { runs });
      })
      // TODO need implementations for both of these really
      // What do we do if we fail to join the worker channel?
      .receive('error', (e) => {
        delete workloop.openClaims[claimId];
        logger.error('Error on claim', e);
        reject(new Error('claim error'));
      })
      .receive('timeout', () => {
        delete workloop.openClaims[claimId];
        logger.error('TIMEOUT on claim. Runs may be lost.');
        reject(new Error('timeout'));
      })
      .receive('*', (response) => {
        delete app.openClaims[claimId];
        logger.error(`[Claim ${claimId}] Received UNEXPECTED response status. Full response:`, JSON.stringify(response, null, 2));
        logger.error(`[Claim ${claimId}] Channel state:`, app.queueChannel?.state);
        reject(new Error('unexpected response status'));
      });
  });
};

export default claim;
