import type { Logger } from '@openfn/logger';
import executeExpression from './expression';
import type {
  CompiledExecutionPlan,
  ExecutionPlan,
  JobNodeID,
  Options,
  State,
} from '../types';
import clone from '../util/clone';
import validatePlan from '../util/validate-plan';
import compileConditions from './compile-plan';

type ExeContext = {
  plan: CompiledExecutionPlan;
  logger: Logger;
  opts: Options;
};

const assembleState = (
  initialState: any = {},
  configuration = {},
  data = {}
) => ({
  configuration: Object.assign(
    {},
    initialState.configuration ?? {},
    configuration
  ),
  data: Object.assign({}, initialState.data || {}, data),
});

const executePlan = async (
  plan: ExecutionPlan,
  initialState: State = {},
  opts: Options,
  logger: Logger
) => {
  let compiledPlan;
  try {
    validatePlan(plan);
    compiledPlan = compileConditions(plan);
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

  let queue: string[] = [];
  for (const jobId in compiledPlan.start) {
    const edge = compiledPlan.start[jobId];
    if (!edge.condition || edge.condition(initialState)) {
      queue.push(jobId);
    }
  }

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
  const job = ctx.plan.jobs[jobId];

  if (!job) {
    // TODO do something if we couldn't find this step in the plan
    return { next, state: null };
  }

  const state = assembleState(initialState, job.configuration, job.data);
  // The expression SHOULD return state, but could return anything
  const result = await executeExpression(
    job.expression,
    state,
    ctx.logger,
    ctx.opts
  );
  if (job.next) {
    for (const nextJobId in job.next) {
      const edge = job.next[nextJobId];
      if (!edge.condition || edge.condition(result)) {
        next.push(nextJobId);
      }
      // TODO errors and acceptErrors
    }
  }
  return { next, state: result };
};

export default executePlan;
