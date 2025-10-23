// TODO let me deal with the fallout first

import { EngineAPI } from '../types';

// Simple validation function to ensure that a worker is loaded
// Call a handshake task in a worker thread
// This really just validates that the worker path exists but we add a timeout
// and retry logic to account for containerized environments with filesystem boot
// delays (e.g. Kubernetes)

export default async (
  api: EngineAPI,
  timeout = 5000,
  retries = 5
): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      // TODO argument drive this
      await api.callWorker('handshake', [], {}, { timeout });
      return;
    } catch (e) {
      if (i === retries - 1) {
        throw new Error('Invalid worker path');
      }
      // exponential backoff: 1s, 2s, 4s, etc.
      const backoffMs = 1000 * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
};
