import { fileURLToPath } from 'node:url';
import path from 'node:path';
import workerpool from 'workerpool';
import { EngineAPI } from '../types';

// All events coming out of the worker need to include a type key
type WorkerEvent = {
  type: string;
  [key: string]: any;
};

type WorkerOptions = {
  minWorkers?: number;
  maxWorkers?: number;
  env?: any;
};

// Adds a `callWorker` function to the API object, which will execute a task in a worker
export default function initWorkers(
  api: EngineAPI,
  workerPath: string,
  options: WorkerOptions = {}
) {
  // TODO can we verify the worker path and throw if it's invalid?
  // workerpool won't complain if we give it a nonsense path
  const workers = createWorkers(workerPath, options);
  api.callWorker = (task: string, args: any[] = [], events: any = {}) => workers.exec(task, args, {
      on: ({ type, ...args }: WorkerEvent) => {
        // just call the callback
        events[type]?.(args);
      },
  })

  api.closeWorkers = () => workers.terminate();
}

export function createWorkers(workerPath: string, options: WorkerOptions) {
  const {
    env = {},
    minWorkers = 0,
    maxWorkers = 5, // what's a good default here? Keeping it low to be conservative
  } = options;

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

  return workerpool.pool(resolvedWorkerPath, {
    minWorkers,
    maxWorkers,
    workerThreadOpts: {
      // Note that we have to pass this explicitly to run in ava's test runner
      execArgv: ['--no-warnings', '--experimental-vm-modules'],
      // Important to override the child env so that it cannot access the parent env
      env,
    },
  });
}
