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
import type { RuntimeSlotGroup } from '../util/parse-queues';

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
  group: RuntimeSlotGroup;
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
  logger: Logger = mockLogger,
  options: ClaimOptions
) => {
  return new Promise<void>((resolve, reject) => {
    const { group, demand = 1 } = options;
    const podName = NAME ? `[${NAME}] ` : '';

    const activeInGroup = group.activeRuns.size;
    const maxSlots = group.maxSlots;

    const pendingGroupClaims = Object.values(group.openClaims).reduce(
      (a, b) => a + b,
      0
    );

    if (activeInGroup >= maxSlots) {
      // Important: stop the group workloop so that we don't try and claim any more
      group.workloop?.stop(
        `group ${group.id} at capacity (${activeInGroup}/${maxSlots})`
      );
      return reject(new ClaimError('Server at capacity'));
    } else if (activeInGroup + pendingGroupClaims >= maxSlots) {
      group.workloop?.stop(
        `group ${group.id} at capacity (${activeInGroup}/${maxSlots}, ${pendingGroupClaims} pending)`
      );
      return reject(new ClaimError('Server at capacity'));
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

    // Track in both group-level and app-level openClaims for backward compat
    group.openClaims[claimId] = demand;
    app.openClaims ??= {};
    app.openClaims[claimId] = demand;

    const { used_heap_size, heap_size_limit } = v8.getHeapStatistics();
    const usedHeapMb = Math.round(used_heap_size / 1024 / 1024);
    const totalHeapMb = Math.round(heap_size_limit / 1024 / 1024);
    const memPercent = Math.round((usedHeapMb / totalHeapMb) * 100);
    logger.debug(
      `Claiming runs [${group.id}] :: demand ${demand} | capacity ${activeInGroup}/${maxSlots} | memory ${memPercent}% (${usedHeapMb}/${totalHeapMb}mb)`
    );

    app.events.emit(INTERNAL_CLAIM_START);
    const start = Date.now();
    app.queueChannel
      .push<ClaimPayload>(CLAIM, {
        demand,
        worker_name: NAME || null,
        queues: group.queues,
      })
      .receive('ok', async ({ runs }: ClaimReply) => {
        delete group.openClaims[claimId];
        delete app.openClaims[claimId];
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

          // Track run in group
          group.activeRuns.add(run.id);
          app.runGroupMap[run.id] = group;

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
        delete group.openClaims[claimId];
        delete app.openClaims[claimId];
        logger.error('Error on claim', e);
        reject(new Error('claim error'));
      })
      .receive('timeout', () => {
        delete group.openClaims[claimId];
        delete app.openClaims[claimId];
        logger.error('TIMEOUT on claim. Runs may be lost.');
        reject(new Error('timeout'));
      });
  });
};

export default claim;
