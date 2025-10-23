import { Logger } from '@openfn/logger';
import { EngineAPI } from '../types';

class WorkerValidationError extends Error {
  name = 'WorkerValidationError';
  constructor(message: string) {
    super(message);
  }
}

// Simple validation function to ensure that a worker is loaded
// Call a handshake task in a worker thread
// Validates that the worker
// Timeout and retry logic to help on containerized environments
// (e.g. Kubernetes) with filesystem boot delays
export default async (
  api: EngineAPI,
  logger: Logger,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> => {
  const { timeout = Infinity, retries = 1 } = options;
  let start = Date.now();
  for (let i = 0; i < retries; i++) {
    try {
      // TODO argument drive this
      await api.callWorker('handshake', [], {}, { timeout });
      const duration = Date.now() - start;
      logger.debug(`Worker validated in ${duration}ms`);
      return;
    } catch (e) {
      if (i >= retries - 1) {
        const duration = Date.now() - start;
        logger.error(`Worker validation failed in in ${duration}ms`);
        throw new WorkerValidationError(`Failed to validate worker thread. This likely happened because:
1. An invalid worker file was passed to the engine
2. The filesystem was temporarily unavailable`);
      }

      // exponential backoff: 1s, 2s, 4s, etc.
      const backoffMs = 1000 * Math.pow(2, i);
      logger.warn(`Worker validation failed: will retry in ${backoffMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
};
