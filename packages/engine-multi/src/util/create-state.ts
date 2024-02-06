import { ExecutionPlan, State } from '@openfn/lexicon';
import { WorkflowState } from '../types';

export default (plan: ExecutionPlan, input: State): WorkflowState => ({
  id: plan.id!,
  status: 'pending',
  plan,
  input,

  threadId: undefined,
  startTime: undefined,
  duration: undefined,
  error: undefined,
  result: undefined,
});
