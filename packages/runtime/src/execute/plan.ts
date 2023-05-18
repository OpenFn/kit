import type { Logger } from '@openfn/logger';
import { createDraft, finishDraft, isDraft, freeze } from 'immer';

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

  let lastState = initialState;

  // Right now this executes in series, even if jobs are parallelised
  while (queue.length) {
    const next = queue.shift();
    // find the upstream state
    const draft = createDraft(lastState);
    // console.log('draft:', lastState);
    // What if a new state object is returned though?
    console.log('isDraft:', isDraft(draft));
    const result = await executeJob(ctx, next!, draft);
    // console.log('result:', lastState);
    if (result.next) {
      queue.push(...result.next);
    }
    // save a clone state to the index
    if (isDraft(result.state)) {
      console.log('> finish draft');
      lastState = finishDraft(result.state);
    } else {
      console.log('> freeze');
      lastState = freeze(result.state);
    }
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

  ctx.logger.timer('job');
  ctx.logger.always('Starting job', jobId);

  // const state = assembleState(
  //   initialState,
  //   job.configuration,
  //   job.data,
  //   ctx.opts.strict
  // );
  // console.log('initial:', state);
  const state = initialState;

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
      ctx.logger.success(`Completed job ${jobId} in ${duration}`);
    } catch (e: any) {
      const duration = ctx.logger.timer('job');
      ctx.logger.error(`Failed job ${jobId} after ${duration}`);
      ctx.report(state, jobId, e);
    }
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
