import tryWithBackoff from '../util/try-with-backoff';
import claim from './claim';

import type { ServerApp } from '../server';
import type { CancelablePromise } from '../types';
import type { Logger } from '@openfn/logger';

export class Workloop {
  id: string;
  queues: string[];
  capacity: number;
  activeRuns = new Set<string>();
  openClaims: Record<string, number> = {};

  private cancelled = true;
  private promise?: CancelablePromise;
  private logger?: Logger;

  constructor({
    id,
    queues,
    capacity,
  }: {
    id: string;
    queues: string[];
    capacity: number;
  }) {
    this.id = id;
    this.queues = queues;
    this.capacity = capacity;
  }

  hasCapacity(): boolean {
    const pendingClaims = Object.values(this.openClaims).reduce(
      (a, b) => a + b,
      0
    );
    return this.activeRuns.size + pendingClaims < this.capacity;
  }

  start(
    app: ServerApp,
    logger: Logger,
    minBackoff: number,
    maxBackoff: number
  ): void {
    this.logger = logger;
    this.cancelled = false;

    const loop = () => {
      if (!this.cancelled) {
        this.promise = tryWithBackoff(() => claim(app, this, logger), {
          min: minBackoff,
          max: maxBackoff,
        });
        this.promise
          .then(() => {
            if (!this.cancelled) {
              setTimeout(loop, minBackoff);
            }
          })
          .catch(() => {
            // do nothing
          });
      }
    };
    loop();
  }

  stop(reason = 'reason unknown'): void {
    if (!this.cancelled) {
      this.logger?.info(`cancelling workloop: ${reason}`);
      this.cancelled = true;
      this.promise?.cancel();
    }
  }

  isStopped(): boolean {
    return this.cancelled;
  }
}
