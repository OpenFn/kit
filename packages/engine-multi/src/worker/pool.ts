import { ChildProcess, fork } from 'node:child_process';
import { ExitError, TimeoutError } from '../errors';
import { HANDLED_EXIT_CODE } from './worker-helper';
import path from 'node:path';
import {
  ENGINE_REJECT_TASK,
  ENGINE_RESOLVE_TASK,
  ENGINE_RUN_TASK,
} from './events';

// NB this is the ATTEMPT timeout
const DEFAULT_TIMEOUT = 1000 * 60 * 10;

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

type ExecOpts = {
  // for parity with workerpool, but this will change later
  on?: (event: any) => void;

  timeout?: number; // ms
};

const envPath = path.resolve('./dist/worker/child/runner.js');

// creates a new pool of workers which use the same script
function createPool(script: string, options: PoolOptions = {}) {
  const capacity = options.capacity || options.maxWorkers || 5;

  let destroyed = false;

  // a pool of processes
  const pool = new Array(capacity).fill(false);

  const queue: any[] = [];

  // Keep track of all the workers we created
  const allWorkers: Record<number, ChildProcess> = {};

  const init = (child: any) => {
    if (!child) {
      // create a new child process and load the module script into it
      child = fork(envPath, [script], {
        execArgv: ['--experimental-vm-modules', '--no-warnings'],

        // child will live if parent dies.
        // although tbf, what's the point?
        // detached: true,

        env: options.env || {},

        // don't inherit the parent's stdout
        // maybe good in prod, maybe bad for dev
        silent: options.silent,
      });
      allWorkers[child.pid] = child;
    }
    return child;
  };

  const finish = (worker) => {
    worker.removeAllListeners();

    if (destroyed) {
      killWorker(worker);
    } else {
      // restore the worker to the pool
      pool.splice(0, 0, worker);

      if (queue.length) {
        // TODO actually I think if there's a queue we should empty it first
        const { task, args, resolve, opts } = queue.shift();

        // TODO don't process the queue if destroyed
        exec(task, args, opts).then(resolve);
      }
    }
  };

  const exec = (task: string, args: any[], opts: ExecOpts = {}) => {
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
        return queue.push({ task, args, opts, resolve });
      }

      // what happens if the queue is full?
      // Do we throw?
      // workerpool would queue it for us I think
      // but I think the worker is more responsible for this.  hmm.
      const worker = init(pool.pop());
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

      worker.on('exit', (code: number) => {
        if (code !== HANDLED_EXIT_CODE) {
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
            e.name = evt.type;
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
      killWorker(pool.pop());
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
