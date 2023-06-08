import type { Logger } from '@openfn/logger';
import executeExpression from './expression';
import compilePlan from './compile-plan';
import assembleState from '../util/assemble-state';
import type {
  CompiledExecutionPlan,
  CompiledJobNode,
  ExecutionPlan,
  JobNodeID,
  State,
} from '../types';
import type { Options } from '../runtime';
import clone from '../util/clone';
import validatePlan from '../util/validate-plan';
import createErrorReporter, { ErrorReporter } from '../util/log-error';

type ExeContext = {
  plan: CompiledExecutionPlan;
  logger: Logger;
  opts: Options;
  report: ErrorReporter;
};

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
  };

  type State = any;
  // record of state returned by every job
  const stateHistory: Record<string, State> = {};
  // Record of state on lead nodes (nodes with no next)
  const leaves: Record<string, State> = {};

  // Right now this executes in series, even if jobs are parallelised
  while (queue.length) {
    const next = queue.shift()!;
    const job = compiledPlan.jobs[next];

    const prevState = stateHistory[job.previous || ''] ?? initialState;

    const state = assembleState(
      clone(prevState),
      job.configuration,
      job.state,
      ctx.opts.strict
    );
    const result = await executeJob(ctx, job, state);
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

const executeJob = async (
  ctx: ExeContext,
  job: CompiledJobNode,
  state: State
): Promise<{ next: JobNodeID[]; state: any }> => {
  const next: string[] = [];

  // We should by this point have validated the plan, so the job MUST exist

  ctx.logger.timer('job');
  ctx.logger.always('Starting job', job.id);

  let result: any = state;
  if (job.expression) {
    // The expression SHOULD return state, but could return anything
    try {
      result = await executeExpression(
        job.expression,
        state,
        ctx.logger,
        ctx.opts
      );
      const duration = ctx.logger.timer('job');
      ctx.logger.success(`Completed job ${job.id} in ${duration}`);
    } catch (e: any) {
      const duration = ctx.logger.timer('job');
      ctx.logger.error(`Failed job ${job.id} after ${duration}`);
      ctx.report(state, job.id, e);
    }
  }

  if (job.next) {
    for (const nextJobId in job.next) {
      const edge = job.next[nextJobId];
      if (
        edge &&
        (edge === true || !edge.condition || edge.condition(result))
      ) {
        next.push(nextJobId);
      }
      // TODO errors
    }
  }
  return { next, state: result };
};

export default executePlan;
