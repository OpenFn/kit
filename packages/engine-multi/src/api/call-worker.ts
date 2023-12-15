import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type { EngineAPI } from '../types';
import type { Logger } from '@openfn/logger';

import createPool from '../worker/pool';

// All events coming out of the worker need to include a type key
type WorkerEvent = {
  type: string;
  [key: string]: any;
};

type WorkerOptions = {
  maxWorkers?: number;
  env?: any;
  timeout?: number; // ms
  memoryLimitMb?: number;

  silent?: boolean; // don't forward stdout to the parent
};

// Adds a `callWorker` function to the API object, which will execute a task in a worker
export default function initWorkers(
  engine: EngineAPI,
  workerPath: string,
  options: WorkerOptions = {},
  logger?: Logger
) {
  const workers = createWorkers(workerPath, options);

  engine.callWorker = (
    task: string,
    args: any[] = [],
    events: any = {},
    timeout?: number
  ) =>
    workers.exec(task, args, {
      timeout,
      on: ({ type, ...args }: WorkerEvent) => {
        // just call the callback
        events[type]?.(args);
      },
    });

  engine.closeWorkers = async (instant?: boolean) => workers.destroy(instant);
}

export function createWorkers(workerPath: string, options: WorkerOptions) {
  const {
    env = {},
    maxWorkers = 5, // what's a good default here? Keeping it low to be conservative
    memoryLimitMb,
    silent,
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

  return createPool(resolvedWorkerPath, {
    maxWorkers,
    env,
    silent,

    // TODO need to support this
    // resourceLimits: {
    //   // This is a fair approximation for heapsize
    //   // Note that it's still possible to OOM the process without hitting this limit
    //   maxOldGenerationSizeMb: memoryLimitMb,
    // },
  });
}
