import type { Logger } from '@openfn/logger';
import executeExpression from './expression';
import type { ExecutionPlan, Options } from '../types';
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

let idCount = 0;

const ensureIds = (plan) => {
  plan.jobs.forEach((job) => {
    if (!job.id) {
      job.id = ++idCount;
    }
  });
};

// const indexJobsById = (plan) => {

// }

// TODO accept initial state
// On the first job, merge state and initialState
const executePlan = async (
  plan: ExecutionPlan,
  initialState: State = {},
  opts: Options,
  logger: Logger
) => {
  const { jobs } = plan;

  const ctx = {
    plan,
    opts,
    logger,
  };

  ensureIds(plan);

  const first = jobs[0];
  let next = first.id;

  let lastState = initialState;
  while (next) {
    const result = await executeStep(ctx, next, clone(lastState));
    next = result.next;
    lastState = result.state;
  }

  return lastState;
};

const executeStep = async (
  ctx: ExeContext,
  stepId: string,
  initialState: State
) => {
  let next;
  const job = ctx.plan.jobs.find(({ id }) => id === stepId);

  if (!job) {
    // TODO do something if we couldn't find this step in the plan
    return { next: null, result: null };
  }

  const state = assembleState(initialState, job.configuration, job.data);

  const result = await executeExpression(
    job.expression,
    state,
    ctx.logger,
    ctx.opts
  );
  if (job.upstream) {
    // TODO what about arbitary conditions?
    // Maybe upstream is a priortised array of conditions against state
    // First to pass wins
    if (result && result.error) {
      // error reported in the last state!
      // call on error or fail
      next = job?.upstream.error ?? null;
    } else {
      next = job?.upstream.success ?? job?.upstream.default ?? job?.upstream;
    }
  }
  return { next, state: result };
};

export default executePlan;
