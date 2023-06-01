// Runs inside the worker

// Dedicated worker for running jobs
// Security thoughts: the process inherits the node command arguments
// (it has to for experimental modules to work)
// Is this a concern? If secrets are passed in they could be visible
// The sandbox should help

// What about imports in a worker thread?
// Is there an overjhead in reimporting stuff (presumably!)
// Should we actually be pooling workers by adaptor[+version]
// Does this increase the danger of sharing state between jobs?
// Suddenly it's a liability for the same environent in the same adaptor
// to be running the same jobs - break out of the sandbox and who knows what you can get
import workerpool from 'workerpool';
import run from '@openfn/runtime';
import type { ExecutionPlan } from '@openfn/runtime';
import createLogger from '@openfn/logger';
import helper from './worker-helper';

// TODO how can we control the logger in here?
// Need some kind of intitialisation function to set names and levels
const logger = createLogger('R/T', { level: 'debug' });
const jobLogger = createLogger('JOB', { level: 'debug' });

workerpool.worker({
  run: (plan: ExecutionPlan, repoDir: string) => {
    const options = {
      logger,
      jobLogger,
      linker: {
        repo: repoDir,
      },
    };

    return helper(plan.id!, () => run(plan, {}, options));
  },
});
