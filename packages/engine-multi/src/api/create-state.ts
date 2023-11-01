import { ExecutionPlan } from '@openfn/runtime';
import { WorkflowState } from '../types';

export default (plan: ExecutionPlan, options = {}): WorkflowState => ({
  id: plan.id!,
  status: 'pending',
  plan,

  threadId: undefined,
  startTime: undefined,
  duration: undefined,
  error: undefined,
  result: undefined,

  // this is wf-specific options
  // but they should be on context, rather than state
  options,
  // options: {
  //   ...options,
  //   repoDir,
  // },
});
