import type { Logger } from '@openfn/logger';
import executeJob from './job';
import compilePlan from './compile-plan';

import type { ExecutionPlan } from '../types';
import type { Options } from '../runtime';
import validatePlan from '../util/validate-plan';
import createErrorReporter from '../util/log-error';
import { NOTIFY_STATE_LOAD } from '../util/notify';

const executePlan = async (
  plan: ExecutionPlan,
  opts: Options,
  logger: Logger
) => {
  let compiledPlan;
  try {
    validatePlan(plan);
    compiledPlan = compilePlan(plan);
  } catch (e: any) {
    logger.error('Error validating execution plan');
    logger.error(e);
    logger.error('Aborting');
    throw e;
  }

  let queue: string[] = [opts.start || compiledPlan.start];

  const ctx = {
    plan: compiledPlan,
    opts,
    logger,
    report: createErrorReporter(logger),
    notify: opts.callbacks?.notify ?? (() => {}),
  };

  type State = any;
  // record of state returned by every job
  const stateHistory: Record<string, State> = {};
  // Record of state on lead nodes (nodes with no next)
  const leaves: Record<string, State> = {};

  let { initialState } = compiledPlan;
  if (typeof initialState === 'string') {
    const id = initialState;
    const startTime = Date.now();
    logger.debug(`fetching intial state ${id}`);

    initialState = await opts.callbacks?.resolveState?.(id);

    const duration = Date.now() - startTime;
    opts.callbacks?.notify?.(NOTIFY_STATE_LOAD, { duration, id });
    logger.success(`loaded state for ${id} in ${duration}ms`);

    // TODO catch and re-throw
  }

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
