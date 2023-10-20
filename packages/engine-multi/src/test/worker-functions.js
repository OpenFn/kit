import path from 'node:path';
import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';

import { increment } from './counter.js';

workerpool.worker({
  handshake: () => true,
  test: (result = 42) => {
    const { pid, scribble } = process;

    workerpool.workerEmit({
      type: 'message',
      result,
      pid,
      scribble,
    });

    return result;
  },
  readEnv: (key) => {
    if (key) {
      return process.env[key];
    }
    return process.env;
  },
  threadId: () => threadId,
  // very very simple intepretation of a run function
  // Most tests should use the mock-worker instead
  run: (plan, _adaptorPaths) => {
    const workflowId = plan.id;
    workerpool.workerEmit({
      type: 'worker:workflow-start',
      workflowId,
      threadId,
    });
    try {
      const [job] = plan.jobs;
      const result = eval(job.expression);

      workerpool.workerEmit({
        type: 'worker:workflow-complete',
        workflowId,
        state: result,
        threadId,
      });
    } catch (err) {
      // console.error(err);
      // // @ts-ignore TODO sort out error typing
      // workerpool.workerEmit({
      //   type: 'worker:workflow-error',
      //   workflowId,
      //   message: err.message,
      //   threadId,
      // });
      // actually, just throw the error back out
      throw err;
    }
  },

  // Experiments with freezing the global scope
  // We may do this in the actual worker
  freeze: () => {
    // This is not a deep freeze, so eg global.Error is not frozen
    // Also some things like Uint8Array are not freezable, so these remain ways to scribble
    Object.freeze(global);
    Object.freeze(globalThis);

    // Note that this is undefined, so this doesn't matter
    Object.freeze(this);
  },

  setGlobalX: (newValue = 42) => {
    global.x = newValue;
  },

  getGlobalX: () => global.x,

  writeToGlobalError: (obj) => {
    Object.assign(Error, obj);
  },

  getFromGlobalError: (key) => Error[key],

  // Tests of module state across executions
  // Ie, does a module get re-initialised between runs? (No.)
  incrementStatic: () => increment(),
  incrementDynamic: async () => {
    const { increment } = await import(path.resolve('src/test/counter.js'));
    return increment();
  },
});
