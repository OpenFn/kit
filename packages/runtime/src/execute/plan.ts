import type { Logger } from '@openfn/logger';
import executeExpression from './expression';
import compilePlan from './compile-plan';
import assembleState from '../util/assemble-state';
import type {
  CompiledExecutionPlan,
  ExecutionPlan,
  JobNodeID,
  State,
} from '../types';
import type { Options } from '../runtime';
import clone from '../util/clone';
import validatePlan from '../util/validate-plan';

type ExeContext = {
  plan: CompiledExecutionPlan;
  logger: Logger;
  opts: Options;
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
    return {
      error: {
        code: 1, // TODO what error code is an invalid plan?
        // TODO compilation may throw several errors, for now we'll just
        // concatenate them into one big message
        message: Array.isArray(e)
          ? e.map((e: any) => e.message).join('\n')
          : e.message,
      },
    };
  }

  let queue: string[] = [opts.start || compiledPlan.start];

  const ctx = {
    plan: compiledPlan,
    opts,
    logger,
  };

  let lastState = initialState;

  // Right now this executes in series, even if jobs are parallelised
  while (queue.length) {
    const next = queue.shift();
    const result = await executeJob(ctx, next!, clone(lastState));
    if (result.next) {
      queue.push(...result.next);
    }
    lastState = result.state;
  }
  return lastState;
};

const executeJob = async (
  ctx: ExeContext,
  jobId: string,
  initialState: State
): Promise<{ next: JobNodeID[]; state: any }> => {
  const next: string[] = [];

  // We should by this point have validated the plan, so the job MUST exist
  const job = ctx.plan.jobs[jobId];

  const state = assembleState(
    initialState,
    job.configuration,
    job.data,
    ctx.opts.strict
  );
  let result: any = state;
  if (job.expression) {
    // The expression SHOULD return state, but could return anything
    result = await executeExpression(
      job.expression,
      state,
      ctx.logger,
      ctx.opts
    );
  }
  if (job.next) {
    for (const nextJobId in job.next) {
      const edge = job.next[nextJobId];
      if (!edge.condition || edge.condition(result)) {
        next.push(nextJobId);
      }
      // TODO errors
    }
  }
  return { next, state: result };
};

export default executePlan;
