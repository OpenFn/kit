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
  // // very basic simulation of a run
  // hmm, don't use this, use mock worker instead
  // run: (plan, adaptorPaths) => {
  //   workerpool.workerEmit({ type: e.WORKFLOW_START, workflowId, threadId });
  //   try {
  //     // TODO
  //     // workerpool.workerEmit({
  //     //   type: e.WORKFLOW_LOG,
  //     // });

  //     // or something
  //     const result = eval(plan);

  //     workerpool.workerEmit({
  //       type: e.WORKFLOW_COMPLETE,
  //       workflowId,
  //       state: result,
  //     });

  //     // For tests
  //     return result;
  //   } catch (err) {
  //     console.error(err);
  //     // @ts-ignore TODO sort out error typing
  //     workerpool.workerEmit({
  //       type: e.WORKFLOW_ERROR,
  //       workflowId,
  //       message: err.message,
  //     });
  //   }
  // },
});
