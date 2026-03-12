import tryWithBackoff from '../util/try-with-backoff';
import claim from './claim';

import type { ServerApp } from '../server';
import type { CancelablePromise } from '../types';
import type { Logger } from '@openfn/logger';
import type { WorkloopConfig } from '../util/parse-workloops';

export interface Workloop extends WorkloopConfig {
  id: string;
  activeRuns: Set<string>;
  openClaims: Record<string, number>;
}

export interface WorkloopHandle {
  stop: (reason?: string) => void;
  isStopped: () => boolean;
}

export function createWorkloop(config: WorkloopConfig): Workloop {
  return {
    ...config,
    id: `${config.queues.join('>')}:${config.capacity}`,
    activeRuns: new Set(),
    openClaims: {},
  };
}

export function workloopHasCapacity(workloop: Workloop): boolean {
  const pendingClaims = Object.values(workloop.openClaims).reduce(
    (a, b) => a + b,
    0
  );
  return workloop.activeRuns.size + pendingClaims < workloop.capacity;
}

const startWorkloop = (
  app: ServerApp,
  logger: Logger,
  minBackoff: number,
  maxBackoff: number,
  workloop: Workloop
): WorkloopHandle => {
  let promise: CancelablePromise;
  let cancelled = false;

  const workLoop = () => {
    if (!cancelled) {
      promise = tryWithBackoff(() => claim(app, workloop, logger), {
        min: minBackoff,
        max: maxBackoff,
      });
      // TODO this needs more unit tests I think
      promise
        .then(() => {
          if (!cancelled) {
            setTimeout(workLoop, minBackoff);
          }
        })
        .catch(() => {
          // do nothing
        });
    }
  };
  workLoop();

  const stop = (reason = 'reason unknown') => {
    if (!cancelled) {
      logger.info(`cancelling workloop: ${reason}`);
      cancelled = true;
      promise.cancel();
    }
  };
  const isStopped = () => cancelled;

  return { stop, isStopped };
};

export default startWorkloop;
