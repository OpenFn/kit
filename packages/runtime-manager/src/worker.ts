// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should hep
import workerpool from 'workerpool';
import { threadId } from 'node:worker_threads';
import vm from 'node:vm';
import runJob from '@openfn/runtime';
import * as e from './events';

function publish(event:  e.JobEvent) {
  workerpool.workerEmit(event);
}

// When the worker starts, it should report back its id
// We need the runaround here because our worker pool obfuscates it
function init(jobId: number) {
  publish({ type: e.ACCEPT_JOB, jobId, threadId })
}


// For unit tests only
// Not really happy about this
const preparse = (src: string): Array<(s: any) => any> => {
  if (src.startsWith('[') && src.endsWith(']')) {
    const script = new vm.Script(src);
    return script.runInThisContext();
  }
  throw new Error('Invalid job script');
}

const run = async (jobId: number, src: string, state?: any, allowPreparse = false) => {
  init(jobId)
  try {
    let queue;
    if (allowPreparse) {
      queue = preparse(src);
    }
    const result = await runJob(queue || src, state);
    publish({ type: e.COMPLETE_JOB, jobId, state: result })
    return result;
  }
  catch(err) {
    console.error(err)
    // @ts-ignore TODO sort out error typing
    publish({ type: e.JOB_ERROR, jobId, message: err.message })
  }
};

workerpool.worker({
  run
});
