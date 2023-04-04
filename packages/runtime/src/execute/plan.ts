import type { Logger } from '@openfn/logger';
import executeExpression from './expression';
import type { ExecutionPlan, Options } from '../types';

const assembleState = (configuration = {}, data = {}) => ({
  configuration,
  data,
});

const executePlan = (plan: ExecutionPlan, opts: Options, logger: Logger) => {
  const { jobs } = plan;

  const first = jobs[0];
  const state = assembleState(first.configuration, first.data);

  return executeExpression(first.expression, state, logger, opts);
};

export default executePlan;
