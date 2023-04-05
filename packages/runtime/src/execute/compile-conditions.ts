import type { CompiledExecutionPlan, ExecutionPlan } from '../types';

import compileFunction from '../modules/compile-function';
import { preconditionContext } from './context';

export default (plan: ExecutionPlan) => {
  const context = preconditionContext();

  if (plan.precondition && typeof plan.precondition === 'string') {
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
          if (edge.condition && typeof edge.condition === 'string') {
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
