import path from 'node:path';
import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import v8 from 'v8';

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

  timeout: () => {
    while (true) {}
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

  // Creating a big enough array with  `Array(1e9).fill('mario')`
  // is enghuh to OOM the _process_, taking the whole engine out
  // This function should blow the thread's memory without
  // killing the parent process
  blowMemory: () => {
    let data = [];
    while (true) {
      data.push(Array(1e6).fill('mario'));
    }

    // This is too extreme and will kill the process
    // Array(1e9).fill('mario')
  },

  // Some useful code
  // const stats = v8.getHeapStatistics();
  // console.log(
  //   `node heap limit = ${
  //     stats.heap_size_limit / 1024 / 1024
  //   } Mb\n heap used = ${hprocess.memoryUsage().heapUsed / 1024 / 1024}mb`
  // );
});
