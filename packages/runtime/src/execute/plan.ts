import type { Logger } from '@openfn/logger';
import type { ExecutionPlan, State, Lazy } from '@openfn/lexicon';

import executeStep from './step';
import compilePlan from './compile-plan';

import type { Options } from '../runtime';
import validatePlan from '../util/validate-plan';
import createErrorReporter from '../util/log-error';
import { NOTIFY_STATE_LOAD } from '../events';
import { CompiledExecutionPlan, ExecutionContext } from '../types';

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

  const ctx: ExecutionContext = {
    plan: compiledPlan,
    opts,
    logger,
    report: createErrorReporter(logger),
    notify: opts.callbacks?.notify ?? (() => {}),
    sourceMap: opts.sourceMap
  };

  // Record of state on leaf nodes (nodes with no next)
  const leaves: Record<string, State> = {};

  if (typeof input === 'string') {
    const id = input;
    const startTime = Date.now();
    logger.debug(`fetching initial state ${id}`);

    input = await opts.callbacks?.resolveState?.(id);
    const duration = Date.now() - startTime;
    opts.callbacks?.notify?.(NOTIFY_STATE_LOAD, { duration, jobId: id });
    logger.success(`loaded state for ${id} in ${duration}ms`);
  }

  const queue: Array<{ stepName: string; input: any }> = [
    { stepName: options.start, input },
  ];

  // count how many times each step has been called
  const counts: Record<string, number> = {};

  // Right now this executes in series, even if jobs are parallelised
  while (queue.length) {
    const { stepName, input: prevState } = queue.shift()!;

    const step = workflow.steps[stepName];

    if (isNaN(counts[stepName])) {
      counts[stepName] = 0;
    } else {
      counts[stepName] += 1;
    }

    // create a unique step id
    // leave the first step as just the step name to preserve legacy stuff
    const stepId =
      counts[stepName] === 0 ? stepName : `${step.id}-${counts[stepName]}`;

    const result = await executeStep(ctx, step, prevState);

    const exitEarly = options.end === stepName;
    if (result.state && (exitEarly || !result.next.length)) {
      leaves[stepId] = result.state;
    }

    if (exitEarly) {
      // If this is designated an end point, we should abort
      // (even if there are more steps queued up)
      break;
    }

    result.next?.forEach((next) => {
      queue.push({ stepName: next, input: result.state });
    });
  }

  // If there are multiple leaf results, return them
  if (Object.keys(leaves).length > 1) {
    return leaves;
  }

  // Otherwise return a single value
  return Object.values(leaves)[0];
};

export default executePlan;
