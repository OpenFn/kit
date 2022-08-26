// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should hep
import runJob from '@openfn/runtime';
import workerpool from 'workerpool';
import { threadId } from 'worker_threads';
import * as e from './events';

function publish(event:  e.JobEvent) {
  workerpool.workerEmit(event);
}

// When the worker starts, it should report back its id
// We need the runaround here because our worker pool obfuscates it
function init(jobId: number) {
  publish({ type: e.ACCEPT_JOB, jobId, threadId })
}

const run = async (jobId: number, src: string, state?: any) => {
  init(jobId)
  try {
    const result = await runJob(src, state);
    publish({ type: e.COMPLETE_JOB, jobId, state: result })
    return result;
  }
  catch(err) {
    // @ts-ignore TODO sort out error typing
    publish({ type: e.JOB_ERROR, jobId, message: err.message })
  }
};

workerpool.worker({
  run
});
