import type { Logger } from '@openfn/logger';
import executeExpression from './expression';
import type { ExecutionPlan, JobNodeID, Options, State } from '../types';
import clone from '../util/clone';

type ExeContext = {
  plan: ExecutionPlan;
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

// TODO accept initial state
// On the first job, merge state and initialState
const executePlan = async (
  plan: ExecutionPlan,
  initialState: State = {},
  opts: Options,
  logger: Logger
) => {
  const { start } = plan;

  const ctx = {
    plan,
    opts,
    logger,
  };

  // TODO next needs to be an array now
  // or soon
  // If multiple branches, do we run serial? parallel? What order?
  // should be concurrent really, promises can just sit active
  const queue = [start];

  let lastState = initialState;
  // TODO right now this executes in series, but we should parallelise
  // Keep running until the queue is empty
  while (queue.length) {
    const next = queue.shift();
    const result = await executeStep(ctx, next!, clone(lastState));
    if (result.next) {
      // if result.next > 1, we're in a parallel job and things are a bit more complicated
      queue.push(...result.next);
    }
    // TODO lastState might get a bit hairy when we parallelise?
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
      }
      // @ ts-ignore
      else if (edge.condition?.(result)) {
        // TODO when and how do conditions get parsed?
        next.push(nextJobId);
      }
    }
  }
  return { next, state: result };
};

export default executePlan;
