import type { Logger } from '@openfn/logger';
import type { ExecutionPlan, State, Lazy } from '@openfn/lexicon';

import executeStep from './step';
import compilePlan from './compile-plan';

import type { Options } from '../runtime';
import validatePlan from '../util/validate-plan';
import createErrorReporter from '../util/log-error';
import { NOTIFY_STATE_LOAD } from '../events';
import { CompiledExecutionPlan } from '../types';

const executePlan = async (
  plan: ExecutionPlan,
  input: Lazy<State> | undefined,
  opts: Options,
  logger: Logger
) => {
  let compiledPlan: CompiledExecutionPlan;
  try {
    validatePlan(plan);
    compiledPlan = compilePlan(plan);
  } catch (e: any) {
    logger.error('Error validating execution plan');
    logger.error(e);
    logger.error('Aborting');
    throw e;
  }
  logger.info(`Executing ${plan.workflow.name || plan.id}`);

  const { workflow, options } = compiledPlan;

  let queue: string[] = [options.start];

  const ctx = {
    plan: compiledPlan,
    opts,
    logger,
    report: createErrorReporter(logger),
    notify: opts.callbacks?.notify ?? (() => {}),
  };

  // record of state returned by every job
  const stateHistory: Record<string, State> = {};

  // Record of state on lead nodes (nodes with no next)
  const leaves: Record<string, State> = {};

  if (typeof input === 'string') {
    const id = input;
    const startTime = Date.now();
    logger.debug(`fetching intial state ${id}`);

    input = await opts.callbacks?.resolveState?.(id);
    const duration = Date.now() - startTime;
    opts.callbacks?.notify?.(NOTIFY_STATE_LOAD, { duration, jobId: id });
    logger.success(`loaded state for ${id} in ${duration}ms`);
  }

  // Right now this executes in series, even if jobs are parallelised
  while (queue.length) {
    const next = queue.shift()!;
    const job = workflow.steps[next];

    const prevState = stateHistory[job.previous || ''] ?? input;

    const result = await executeStep(ctx, job, prevState);
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

  // Otherwise return a single value
  return Object.values(leaves)[0];
};

export default executePlan;
