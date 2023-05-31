// utilities to run inside the worker
// This is designed to minimize the amount of code we have to mock

import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import * as e from './events';

function publish(event: e.JobEvent) {
  workerpool.workerEmit(event);
}

// When the worker starts, it should report back its id
// We need the runaround here because our worker pool obfuscates it
function init(jobId: string) {
  publish({ type: e.ACCEPT_JOB, jobId, threadId });
}

async function helper(jobId: string, fn: () => Promise<any>) {
  init(jobId);
  try {
    const result = await fn();
    publish({ type: e.COMPLETE_JOB, jobId, state: result });
    return result;
  } catch (err) {
    console.error(err);
    // @ts-ignore TODO sort out error typing
    publish({ type: e.JOB_ERROR, jobId, message: err.message });
  }
}

export default helper;
