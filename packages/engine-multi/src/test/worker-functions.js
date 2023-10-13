import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';

workerpool.worker({
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
      console.error(err);
      // @ts-ignore TODO sort out error typing
      workerpool.workerEmit({
        type: 'worker:workflow-error',
        workflowId,
        message: err.message,
        threadId,
      });
    }
  },
});
