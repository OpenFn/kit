// TODO hmm. I have a horrible feeling that the callbacks should go here
// at least the resolvesrs
import executeExpression from './expression';
import type {
  CompiledJobNode,
  ExecutionContext,
  JobNodeID,
  State,
} from '../types';

// The job handler is responsible for preparing the job
// and working out where to go next
// it'll resolve credentials and state and notify how long init took
const executeJob = async (
  ctx: ExecutionContext,
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
      result = await executeExpression(ctx, job.expression, state);
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

export default executeJob;
