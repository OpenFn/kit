// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import * as e from './events';

function publish(event: e.WorkflowEvent) {
  workerpool.workerEmit(event);
}

async function helper(jobId: string, fn: () => Promise<any>) {
  publish({ type: e.WORKFLOW_START, jobId, threadId });
  try {
    // Note that the worker thread may fire logs after completion
    // I think this is fine, it's jsut a log stream thing
    // But the output is very confusing!
    const result = await fn();
    publish({ type: e.WORKFLOW_COMPLETE, jobId, state: result });

    // For tests
    return result;
  } catch (err) {
    console.error(err);
    // @ts-ignore TODO sort out error typing
    publish({ type: e.WORKFLOW_ERROR, jobId, message: err.message });
  }
}

export default helper;
