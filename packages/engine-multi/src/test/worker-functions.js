import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';

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
  // very very simple intepretation of a run function
  // Most tests should use the mock-worker instead
  run: (plan, adaptorPaths) => {
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
});
