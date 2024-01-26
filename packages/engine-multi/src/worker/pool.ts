import { fileURLToPath } from 'node:url';
import { ChildProcess, fork } from 'node:child_process';
import path from 'node:path';

import readline from 'node:readline/promises';

import { ExitError, OOMError, TimeoutError } from '../errors';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from './events';
import { HANDLED_EXIT_CODE } from '../events';
import { Logger } from '@openfn/logger';

type PoolOptions = {
  capacity?: number; // defaults to 5
  maxWorkers?: number; // alias for capacity. Which is best?
  env?: Record<string, string>; // default environment for workers

  silent?: boolean;
};

type RunTaskEvent = {
  type: typeof ENGINE_RUN_TASK;
  task: string;
  args: any[];
};

export type ExecOpts = {
  // for parity with workerpool, but this will change later
  on?: (event: any) => void;

  timeout?: number; // ms

  memoryLimitMb?: number;
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
export const returnToPool = (
  pool: ChildProcessPool,
  worker: ChildProcess | false
) => {
  let idx = pool.findIndex((child) => child);
  if (idx === -1) idx = pool.length;
  pool.splice(idx, 0, worker);
};

// creates a new pool of workers which use the same script
function createPool(script: string, options: PoolOptions = {}, logger: Logger) {
  const capacity = options.capacity || options.maxWorkers || 5;

  logger.debug(`pool: Creating new child process pool | capacity: ${capacity}`);
  let destroyed = false;

  // a pool of processes
  const pool: ChildProcessPool = new Array(capacity).fill(false);

  const queue: QueuedTask[] = [];

  // Keep track of all the workers we created
  const allWorkers: Record<number, ChildProcess> = {};

  const init = (child: ChildProcess | false) => {
    if (!child) {
      // create a new child process and load the module script into it
      child = fork(envPath, [script], {
        execArgv: ['--experimental-vm-modules', '--no-warnings'],

        env: options.env || {},

        // This pipes the stderr stream onto the child, so we can read it later
        // stdio: ['ipc', 'ignore', 'pipe'],
      });

      // // TMP
      // // although we should work out how to redirect the stdout
      // // to the runtime log
      // child.stdio[2].on('data', (data) => {
      //   console.log('> ', data);
      // });
      // // console.log(child.stdio);

      logger.debug('pool: Created new child process', child.pid);
      allWorkers[child.pid!] = child;
    } else {
      logger.debug('pool: Using existing child process', child.pid);
    }
    return child;
  };

  const finish = (worker: ChildProcess | false) => {
    if (worker) {
      worker.removeAllListeners();
    }

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

    const promise = new Promise(async (resolve, reject) => {
      // TODO what should we do if a process in the pool dies, perhaps due to OOM?
      const onExit = async (code: number) => {
        if (code !== HANDLED_EXIT_CODE) {
          logger.debug('pool: Worker exited unexpectedly');
          clearTimeout(timeout);

          // Read the stderr stream from the worked to see if this looks like an OOM error
          const rl = readline.createInterface({
            input: worker.stderr!,
            crlfDelay: Infinity,
          });

          try {
            for await (const line of rl) {
              logger.debug(line);
              if (line.match(/JavaScript heap out of memory/)) {
                reject(new OOMError());

                killWorker(worker);
                // restore a placeholder to the queue
                finish(false);
                return;
              }
            }
          } catch (e) {
            // do nothing
          }

          reject(new ExitError(code));
          finish(worker);
        }
      };

      let timeout: NodeJS.Timeout;
      let didTimeout = false;
      if (!pool.length) {
        logger.debug('pool: Deferring task', task);
        return queue.push({ task, args, opts, resolve });
      }

      const worker = init(pool.pop()!);

      // Start a timeout running
      if (opts.timeout && opts.timeout !== Infinity) {
        // Setup a handler to kill the running worker after the timeout expires
        const timeoutWorker = () => {
          logger.debug('pool: timed out task in worker', worker.pid);
          // Disconnect the on-exit handler
          worker.off('exit', onExit);

          // Kill the worker, just in case it's still processing away
          killWorker(worker);

          // Restore a placeholder in the pool
          pool.splice(0, 0, false);

          reject(new TimeoutError(opts.timeout!));
        };

        timeout = setTimeout(() => {
          timeoutWorker();
        }, opts.timeout);
      }

      try {
        worker.send({
          type: ENGINE_RUN_TASK,
          task,
          args,
          options: {
            memoryLimitMb: opts.memoryLimitMb,
          },
        } as RunTaskEvent);
      } catch (e) {
        // swallow errors here
        // this may occur if the inner worker is invalid
      }

      worker.on('exit', onExit);

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

    return promise;
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
    // TODO set a timeout and force any outstanding workers to die
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
