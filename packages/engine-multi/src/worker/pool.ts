import { fileURLToPath } from 'node:url';
import { ChildProcess, fork } from 'node:child_process';
import path from 'node:path';

import { ExitError, TimeoutError } from '../errors';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from './events';
import { HANDLED_EXIT_CODE } from '../events';
import { Logger } from '@openfn/logger';

// NB this is the ATTEMPT timeout
const DEFAULT_TIMEOUT = 1000 * 60 * 10;

type PoolOptions = {
  capacity?: number; // defaults to 5
  maxWorkers?: number; // alias for capacity. Which is best?
  env?: Record<string, string>; // default environment for workers

  silent?: boolean;

  memoryLimitMb?: number;
};

type RunTaskEvent = {
  type: typeof ENGINE_RUN_TASK;
  task: string;
  args: any[];
};

type ExecOpts = {
  // for parity with workerpool, but this will change later
  on?: (event: any) => void;

  timeout?: number; // ms
};

export type ChildProcessPool = Array<ChildProcess | false>;

type QueuedTask = {
  task: string;
  args: any[];
  opts: ExecOpts;
  resolve: (...args: any[]) => any;
};

let root = path.dirname(fileURLToPath(import.meta.url));
while (!root.endsWith('engine-multi')) {
  root = path.resolve(root, '..');
}
const envPath = path.resolve(root, 'dist/worker/child/runner.js');

// Restore a child at the first non-child process position
// this encourages the child to be reused before creating a new one
export const returnToPool = (pool: ChildProcessPool, worker: ChildProcess) => {
  let idx = pool.findIndex((child) => child);
  if (idx === -1) idx = pool.length;
  pool.splice(idx, 0, worker);
};

// creates a new pool of workers which use the same script
function createPool(script: string, options: PoolOptions = {}, logger: Logger) {
  logger.debug('pool: Creating new child process pool');
  const capacity = options.capacity || options.maxWorkers || 5;
  const memoryLimit = options.memoryLimitMb || 500;

  let destroyed = false;

  // a pool of processes
  const pool: ChildProcessPool = new Array(capacity).fill(false);

  const queue: QueuedTask[] = [];

  // Keep track of all the workers we created
  const allWorkers: Record<number, ChildProcess> = {};

  const init = (child: ChildProcess | false) => {
    if (!child) {
      // create a new child process and load the module script into it
      child = fork(envPath, [script, `${memoryLimit}`], {
        execArgv: ['--experimental-vm-modules', '--no-warnings'],

        env: options.env || {},

        // don't inherit the parent's stdout
        // maybe good in prod, maybe bad for dev
        silent: options.silent,
      });
      logger.debug('pool: Created new child process', child.pid);
      allWorkers[child.pid!] = child;
    } else {
      logger.debug('pool: Using existing child process', child.pid);
    }
    return child;
  };

  const finish = (worker: any) => {
    worker.removeAllListeners();

    if (destroyed) {
      killWorker(worker);
    } else {
      returnToPool(pool, worker);

      const next = queue.pop();
      if (next) {
        // TODO actually I think if there's a queue we should empty it first
        const { task, args, resolve, opts } = next;
        logger.debug('pool: Picking up deferred task', task);

        // TODO don't process the queue if destroyed
        exec(task, args, opts).then(resolve);
      }
    }
  };

  const exec = (task: string, args: any[] = [], opts: ExecOpts = {}) => {
    // TODO Throw if destroyed
    if (destroyed) {
      throw new Error('Worker destroyed');
    }

    // Use a timeout by default
    if (isNaN(opts.timeout!)) {
      opts.timeout = DEFAULT_TIMEOUT;
    }

    const promise = new Promise(async (resolve, reject) => {
      let timeout: NodeJS.Timeout;
      let didTimeout = false;
      if (!pool.length) {
        logger.debug('pool: Deferring task', task);
        return queue.push({ task, args, opts, resolve });
      }

      // what happens if the queue is full?
      // Do we throw?
      // workerpool would queue it for us I think
      // but I think the worker is more responsible for this.  hmm.
      const worker = init(pool.pop()!);
      // Start a timeout running
      if (opts.timeout && opts.timeout !== Infinity) {
        timeout = setTimeout(() => {
          timeoutWorker(worker);
          reject(new TimeoutError(opts.timeout!));
        }, opts.timeout);
      }

      try {
        worker.send({
          type: ENGINE_RUN_TASK,
          task,
          args,
        } as RunTaskEvent);
      } catch (e) {
        // swallow errors here
        // this may occur if the inner worker is invalid
      }

      // TODO what should we do if a process in the pool dies, perhaps due to OOM?
      worker.on('exit', (code: number) => {
        if (code !== HANDLED_EXIT_CODE) {
          logger.debug('pool: Worker exited unexpectedly', task);
          clearTimeout(timeout);
          reject(new ExitError(code));
          finish(worker);
        }
      });

      worker.on('message', (evt: any) => {
        // forward the message out of the pool
        opts.on?.(evt);

        // Listen to a complete event to know the work is done
        if (evt.type === ENGINE_RESOLVE_TASK) {
          clearTimeout(timeout);
          if (!didTimeout) {
            resolve(evt.result);

            finish(worker);
          }
        } else if (evt.type === ENGINE_REJECT_TASK) {
          // Note that this is an unexpected error
          // Actual engine errors should return a workflow:error event and resolve
          clearTimeout(timeout);
          if (!didTimeout) {
            const e = new Error(evt.error.message);
            // @ts-ignore
            e.severity = evt.error.severity;
            e.name = evt.error.type;
            reject(e);

            finish(worker);
          }
        }
      });
    });

    // TODO need a comms channel on the promise

    return promise;
  };

  // This will basically kill the worker to stop execution
  // it must also replace the worker in the pool
  // TODO maybe later the timeout will be handled inside the worker,
  // and we'll just kill the thread, rather than the process
  const timeoutWorker = (worker: ChildProcess | false) => {
    killWorker(worker);
    pool.splice(0, 0, false);
  };

  const killWorker = (worker: ChildProcess | false) => {
    if (worker) {
      worker.kill();
      delete allWorkers[worker.pid!];
    }
  };

  const destroy = (immediate = false) => {
    destroyed = true;

    // Drain the pool
    while (pool.length) {
      killWorker(pool.pop()!);
    }

    if (immediate) {
      Object.values(allWorkers).forEach(killWorker);
    }

    // set a timeout and force any outstanding workers to die
  };

  const api = {
    exec,
    destroy,

    // for debugging and testing
    _pool: pool,
    _queue: queue,
    _allWorkers: allWorkers,
  };

  return api;
}

export default createPool;
