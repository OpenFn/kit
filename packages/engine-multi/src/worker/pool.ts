import { fork } from 'node:child_process';

// creates a pool of child process workers

// notifies capacity changes

const CAPACITY_FULL = 'full';
const CAPACITY_AVAILABLE = 'available';

const events = {
  CAPACITY_CHANGE: 'capacaity-change', // triggered when full or available

  RUN_TASK: 'engine:run_task',
  RESOLVE_TASK: 'engine:resolve_task',
};

type ExecOpts = {
  // callback which will be called on event
  on: (evt: any) => void;
};

type Pool = {
  // For now this uses the workerpool API worker.exec(task, args, options )
  // I am likely to come back in and refactor/optimise later
  // task must refer to a function loaded by the script
  exec: (task: string, args: any[], opts: any) => void;
};

type PoolOptions = {
  capacity?: number; // defaults to 5
};

type RunTaskEvent = {
  type: 'engine:run_task';
  task: string;
  args: any[];
};

// creates a new pool of workers which use the same script
function createPool(script: string, options: PoolOptions = {}) {
  const { capacity = 5 } = options;

  let destroyed = false;

  // a pool of processes
  const pool = new Array(capacity).fill(false);

  const queue: any[] = [];

  // Keep track of all the workers we created
  const allWorkers = {};

  const init = (child: any) => {
    if (!child) {
      // create a new child process and load the module script into it
      child = fork(script, [], {
        execArgv: ['--experimental-vm-modules', '--no-warnings'],
        detached: true, // child will live if parent dies.
        // although tbf, what's the point?
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
        const { task, args, resolve } = queue.shift();

        // TODO don't process the queue if destroyed
        exec(task, args).then(resolve);
      }
    }
  };

  const exec = (task: string, args: any[], opts?: any = {}) => {
    // TODO Throw if destroyed
    if (destroyed) {
      throw new Error('Worker destroyed');
    }

    const promise = new Promise((resolve) => {
      if (!pool.length) {
        return queue.push({ task, args, resolve });
      }

      // what happens if the queue is full?
      // Do we throw?
      // workerpool would queue it for us I think
      // but I think the worker is more responsible for this.  hmm.
      const worker = init(pool.pop());
      worker.send({
        type: events.RUN_TASK,
        task,
      } as RunTaskEvent);

      worker.on('message', (evt) => {
        // forward the message out of the pool witt his nasty api
        opts.on?.(evt);
        if (evt.type === events.RESOLVE_TASK) {
          resolve(evt.result);

          finish(worker);
        }
      });
    });

    // TODO need a comms channel on the promise

    return promise;
  };

  const killWorker = (worker) => {
    if (worker) {
      worker.kill();
      allWorkers[worker.pid].kill();
      delete allWorkers[worker.pid];
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
