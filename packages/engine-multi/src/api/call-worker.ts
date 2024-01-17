import type { EngineAPI } from '../types';
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

// Adds a `callWorker` function to the API object, which will execute a task in a worker
export default function initWorkers(
  engine: EngineAPI,
  workerPath: string,
  options: WorkerOptions = {}
) {
  const {
    env = {},
    maxWorkers = 5, // what's a good default here? Keeping it low to be conservative
    // memoryLimitMb, // TOOD need to restore this
    silent,
  } = options;

  const workers = createPool(workerPath, {
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

  engine.callWorker<any> = (
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
