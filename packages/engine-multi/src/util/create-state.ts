import { ExecutionPlan, State } from '@openfn/lexicon';
import { WorkflowState } from '../types';

// TODO should this be a weakmap for better memory efficiency?
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
