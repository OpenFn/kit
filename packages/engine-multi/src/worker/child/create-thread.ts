// creates a worker thread

import { Worker } from 'node:worker_threads';
import { ENGINE_RUN_TASK } from '../events';

const scriptPath = process.argv[2];

type ThreadOptions = {
  memoryLimitMb?: number;
};

const createThread = (
  task: string,
  args: any[] = [],
  options: ThreadOptions = {}
) => {
  const worker = new Worker(scriptPath, {
    resourceLimits: {
      maxOldGenerationSizeMb: options.memoryLimitMb,
    },
  });
  worker.on('error', (err) => {
    console.log('**** WORKER THREAD ERROR');
    console.log(err);
  });

  worker.postMessage({
    type: ENGINE_RUN_TASK,
    task,
    args,
  });

  return worker;
};
export default createThread;
