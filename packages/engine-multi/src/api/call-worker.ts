import { Logger } from '@openfn/logger';
import createPool from '../worker/pool';
import { CallWorker } from '../types';

// All events coming out of the worker need to include a type key
export type WorkerEvent = {
  type: string;
  [key: string]: any;
};

type WorkerOptions = {
  maxWorkers?: number;
  env?: any;
  timeout?: number; // ms
  silent?: boolean; // don't forward stdout to the parent
};

// Create a worker pool and return helper functions
// to use and destroy it
export default function initWorkers(
  workerPath: string,
  options: WorkerOptions = {},
  logger: Logger
) {
  const { env = {}, maxWorkers = 5, silent } = options;
  const workers = createPool(
    workerPath,
    {
      maxWorkers,
      env,
      silent,
    },
    logger
  );

  const callWorker: CallWorker = (
    task,
    args = [],
    events = {},
    options = {}
  ) => {
    return workers.exec(task, args, {
      ...options,
      on: ({ type, ...args }: WorkerEvent) => {
        // just call the callback
        events[type]?.(args);
      },
    });
  };

  const closeWorkers = async (instant?: boolean) => workers.destroy(instant);

  return { callWorker, closeWorkers, workers };
}
