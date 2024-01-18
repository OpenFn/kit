// creates a worker thread

import { Worker } from 'node:worker_threads';
import { ENGINE_RUN_TASK } from '../events';

const scriptPath = process.argv[2];
const memoryLimit = parseInt(process.argv[3] || '500');

const createThread = (task: string, args: any[] = []) => {
  const worker = new Worker(scriptPath, {
    resourceLimits: {
      maxOldGenerationSizeMb: memoryLimit,
    },
  });

  worker.postMessage({
    type: ENGINE_RUN_TASK,
    task,
    args,
  });

  return worker;
};
export default createThread;
