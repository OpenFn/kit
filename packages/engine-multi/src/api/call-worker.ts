import { fileURLToPath } from 'node:url';
import path from 'node:path';
import workerpool from 'workerpool';
import { EngineAPI } from '../types';

// All events coming out of the worker need to include a type key
type WorkerEvent = {
  type: string;
  [key: string]: any;
};

// Adds a `callWorker` function to the API object, which will execute a task in a worker
export default function initWorkers(api: EngineAPI, workerPath: string) {
  // TODO can we verify the worker path and throw if it's invalid?
  // workerpool won't complain if we give it a nonsense path
  const workers = createWorkers(workerPath);
  api.callWorker = (task: string, args: any[] = [], events: any = {}) =>
    workers.exec(task, args, {
      on: ({ type, ...args }: WorkerEvent) => {
        // just call the callback
        events[type]?.(args);
      },
    });
}

export function createWorkers(workerPath: string) {
  let resolvedWorkerPath;
  if (workerPath) {
    // If a path to the worker has been passed in, just use it verbatim
    // We use this to pass a mock worker for testing purposes
    resolvedWorkerPath = workerPath;
  } else {
    // By default, we load ./worker.js but can't rely on the working dir to find it
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    resolvedWorkerPath = path.resolve(dirname, workerPath || './worker.js');
  }

  return workerpool.pool(resolvedWorkerPath);
}
