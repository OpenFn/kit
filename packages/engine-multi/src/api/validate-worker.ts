// TODO let me deal with the fallout first

import { EngineAPI } from '../types';

// Simple vaidation function to ensure that a worker is loaded
// Call a handshake task in a worker thread
// This really jsut validates that the worker path exists

export default async (api: EngineAPI) => {
  try {
    await api.callWorker('handshake', []);
  } catch {
    // Throw a nice error if the worker isn't valid
    throw new Error('Invalid worker path');
  }
};
