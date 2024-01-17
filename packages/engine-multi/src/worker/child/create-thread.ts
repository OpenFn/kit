// creates a worker thread

import { Worker } from 'node:worker_threads';

const scriptPath = process.argv[2];

const createThread = (task: string, args: any[] = []) => {
  const worker = new Worker(scriptPath);

  worker.postMessage({
    type: 'engine:run_task',
    task,
    args,
  });

  return worker;
};
export default createThread;
