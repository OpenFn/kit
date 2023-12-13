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
  capacity: number; // defaults to 5
};

type RunTaskEvent = {
  type: 'engine:run_task';
  task: string;
  args: any[];
};

// creates a new pool of workers which use the same script
function createPool(script: string, options = {}) {
  const { capacity = 5 } = options;

  // a pool of processes
  const pool = new Array(capacity).fill(false);

  const queue: any[] = [];

  const init = (child: any) => {
    if (!child) {
      // create a new child process and load the module script into it
      return fork(script, [], {
        execArgv: ['--experimental-vm-modules', '--no-warnings'],
        detached: true, // child will live if parent dies.
        // although tbf, what's the point?
      });
    }
    return child;
  };

  const finish = (worker) => {
    // restore the worker to the pool
    pool.splice(0, 0, worker);

    if (queue.length) {
      const { task, args, resolve } = queue.shift();
      exec(task, args).then(resolve);
    }
  };

  const exec = (task: string, args: any[], opts: any) => {
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

      worker.once('message', (evt) => {
        if (evt.type === events.RESOLVE_TASK) {
          resolve(evt.result);

          finish(worker);
        }
      });
    });

    // TODO need a comms channel on the promise

    return promise;
  };

  const api = {
    exec,

    // for debugging and testing
    _pool: pool,
    _queue: queue,
  };

  return api;
}

export default createPool;
