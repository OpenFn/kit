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
import compileFunction from '../modules/compile-function';
import { preconditionContext } from './context';

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

export const compileConditions = (plan: ExecutionPlan) => {
  const context = preconditionContext();

  if (plan.precondition) {
    try {
      (plan as CompiledExecutionPlan).precondition = compileFunction(
        plan.precondition,
        context
      );
    } catch (e: any) {
      throw new Error(`Failed to compile plan precondition (${e.message})`);
    }
  }
  for (const jobId in plan.jobs) {
    const job = plan.jobs[jobId];
    if (job.next) {
      for (const edgeId in job.next) {
        try {
          const edge = job.next[edgeId];
          if (edge.condition) {
            edge.condition = compileFunction(edge.condition, context);
          }
        } catch (e: any) {
          throw new Error(
            `Failed to compile edge condition on ${jobId}-${edgeId}(${e.message})`
          );
        }
      }
    }
  }
  return plan as CompiledExecutionPlan;
};

// TODO accept initial state
// On the first job, merge state and initialState
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
        message: e.message,
      },
    };
  }

  if (compiledPlan.precondition && !compiledPlan.precondition(initialState)) {
    // TODO should we do anything other than return initial state if the precondition fails?
    return initialState;
  }

  const { start } = compiledPlan;

  const ctx = {
    plan: compiledPlan,
    opts,
    logger,
  };

  const queue = [start];

  let lastState = initialState;

  // Right now this executes in series, even if jobs are technically paralleliseds
  while (queue.length) {
    const next = queue.shift();
    const result = await executeStep(ctx, next!, clone(lastState));
    if (result.next) {
      queue.push(...result.next);
    }
    lastState = result.state;
  }

  return lastState;
};

const executeStep = async (
  ctx: ExeContext,
  stepId: string,
  initialState: State
): Promise<{ next: JobNodeID[]; result: any }> => {
  const next: string[] = [];
  const job = ctx.plan.jobs[stepId];

  if (!job) {
    // TODO do something if we couldn't find this step in the plan
    return { next, result: null };
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
      // TODO errors and acceptErrors
      if (edge === true) {
        next.push(nextJobId);
      } else if (edge.condition?.(result)) {
        next.push(nextJobId);
      }
    }
  }
  return { next, state: result };
};

export default executePlan;
