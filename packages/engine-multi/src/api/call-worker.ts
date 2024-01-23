import { Logger } from '@openfn/logger';
import createPool from '../worker/pool';

// All events coming out of the worker need to include a type key
export type WorkerEvent = {
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

// Create a worker pool and return helper functions
// to use and destroy it
export default function initWorkers(
  workerPath: string,
  options: WorkerOptions = {},
  logger: Logger
) {
  const {
    env = {},
    maxWorkers = 5, // what's a good default here? Keeping it low to be conservative
    // memoryLimitMb, // TOOD need to restore this
    silent,
  } = options;

  const workers = createPool(
    workerPath,
    {
      maxWorkers,
      env,
      silent,

      // TODO need to support this
      // resourceLimits: {
      //   // This is a fair approximation for heapsize
      //   // Note that it's still possible to OOM the process without hitting this limit
      //   maxOldGenerationSizeMb: memoryLimitMb,
      // },
    },
    logger
  );

  const callWorker = (
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

  const closeWorkers = async (instant?: boolean) => workers.destroy(instant);

  return { callWorker, closeWorkers };
}
