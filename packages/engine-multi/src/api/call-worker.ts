import { fileURLToPath } from 'node:url';
import path from 'node:path';
import workerpool from 'workerpool';

import { PURGE } from '../events';

import type { EngineAPI } from '../types';
import type { Logger } from '@openfn/logger';

// All events coming out of the worker need to include a type key
type WorkerEvent = {
  type: string;
  [key: string]: any;
};

type WorkerOptions = {
  purge?: boolean;
  minWorkers?: number;
  maxWorkers?: number;
  env?: any;
  timeout?: number; // ms
};

// Adds a `callWorker` function to the API object, which will execute a task in a worker
export default function initWorkers(
  engine: EngineAPI,
  workerPath: string,
  options: WorkerOptions = {},
  logger?: Logger
) {
  // TODO can we verify the worker path and throw if it's invalid?
  // workerpool won't complain if we give it a nonsense path
  const workers = createWorkers(workerPath, options);
  engine.callWorker = (
    task: string,
    args: any[] = [],
    events: any = {},
    timeout?: number
  ) => {
    const promise = workers.exec(task, args, {
      on: ({ type, ...args }: WorkerEvent) => {
        // just call the callback
        events[type]?.(args);
      },
    });

    if (timeout) {
      promise.timeout(timeout);
    }

    return promise;
  };

  // @ts-ignore
  engine.purge = () => {
    const { pendingTasks } = workers.stats();
    if (pendingTasks == 0) {
      logger?.debug('Purging workers');
      engine.emit(PURGE);
      workers.terminate();
    }
  };

  // This will force termination instantly
  engine.closeWorkers = () => {
    workers.terminate(true);

    // Defer the return to allow workerpool to close down
    return new Promise((done) => {
      setTimeout(done, 20);
    });
  };
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
      execArgv: ['--no-warnings', '--experimental-vm-modules'],
      // Important to override the child env so that it cannot access the parent env
      env,
    },
  });
}
