// TODO let me deal with the fallout first

import { EngineAPI } from '../types';

// Simple validation function to ensure that a worker is loaded
// Call a handshake task in a worker thread
// This really jsut validates that the worker path exists

export default async (api: EngineAPI, timeout = 5000) => {
  return;

  try {
    // TODO argument drive this
    await api.callWorker('handshake', [], {}, { timeout });
  } catch (e) {
    throw new Error('Invalid worker path');
  }
};
