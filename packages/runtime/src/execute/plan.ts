import type { Logger } from '@openfn/logger';
import executeJob from './job';
import compilePlan from './compile-plan';

import type { ExecutionPlan, State } from '../types';
import type { Options } from '../runtime';
import validatePlan from '../util/validate-plan';
import createErrorReporter from '../util/log-error';

const executePlan = async (
  plan: ExecutionPlan,
  initialState: State = {},
  opts: Options,
  logger: Logger
) => {
  let compiledPlan;
  try {
    validatePlan(plan);
    compiledPlan = compilePlan(plan);
  } catch (e: any) {
    // If the plan is invalid, abort before trying to execute
    throw e;
  }

  let queue: string[] = [opts.start || compiledPlan.start];

  const ctx = {
    plan: compiledPlan,
    opts,
    logger,
    report: createErrorReporter(logger),
    notify: opts.callbacks?.notify,
  };

  type State = any;
  // record of state returned by every job
  const stateHistory: Record<string, State> = {};
  // Record of state on lead nodes (nodes with no next)
  const leaves: Record<string, State> = {};

  // TODO: maybe lazy load intial state and notify about it

  // Right now this executes in series, even if jobs are parallelised
  while (queue.length) {
    const next = queue.shift()!;
    const job = compiledPlan.jobs[next];

    const prevState = stateHistory[job.previous || ''] ?? initialState;

    const result = await executeJob(ctx, job, prevState);
    stateHistory[next] = result.state;

    if (!result.next.length) {
      leaves[next] = stateHistory[next];
    }

    if (result.next) {
      queue.push(...result.next);
    }
  }

  // If there are multiple leaf results, return them
  if (Object.keys(leaves).length > 1) {
    return leaves;
  }
  // Return a single value
  return Object.values(leaves)[0];
};

export default executePlan;
