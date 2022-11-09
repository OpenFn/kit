// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should hep
import workerpool from 'workerpool';
import helper from './worker-helper';
import run from '@openfn/runtime';

workerpool.worker({
  run: async (jobId: number, src: string, state?: any) => {
    return helper(jobId, async () => run(src, state));
  },
});
