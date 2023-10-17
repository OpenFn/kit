// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should help

// What about imports in a worker thread?
// Is there an overhead in reimporting stuff (presumably!)
// Should we actually be pooling workers by adaptor[+version]
// Does this increase the danger of sharing state between jobs?
// Suddenly it's a liability for the same environent in the same adaptor
// to be running the same jobs - break out of the sandbox and who knows what you can get
import workerpool from 'workerpool';
import run from '@openfn/runtime';
import type { ExecutionPlan } from '@openfn/runtime';
import helper, { createLoggers, publish } from './worker-helper';
import type { WorkerEvents } from './events';

workerpool.worker({
  // TODO: add a startup script to ensure the worker is ok
  // if we can't call init, there's something wrong with the worker
  // and then we have to abort the engine or something
  //init: () => {},
  run: (
    plan: ExecutionPlan,
    adaptorPaths: Record<string, { path: string }>
  ) => {
    const { logger, jobLogger } = createLoggers(plan.id!);
    const options = {
      logger,
      jobLogger,
      linker: {
        modules: adaptorPaths,
      },
      callbacks: {
        // TODO load state (maybe)
        // TODO load credential
        notify: (name: WorkerEvents, payload: any) => {
          // Event handling here is a bit sketchy
          // the runtime will publish eg job-start, but we need to map it to worker:job-start
          // @ts-ignore
          publish(plan.id, `worker:${name}`, payload);
        },
      },
    };

    return helper(plan.id!, () => run(plan, {}, options));
  },
});
