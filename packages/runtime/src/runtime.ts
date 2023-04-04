import { createMockLogger } from '@openfn/logger';
import executePlan from './execute/plan';
import type { Operation, ExecutionPlan, Options, State } from './types';

export const TIMEOUT = 5 * 60 * 1000; // 5 minutes

// TODO move error strings into one file
export const ERR_TIMEOUT = 'timeout';
// TODO maybe this is a job exception? Job fail?
export const ERR_RUNTIME_EXCEPTION = 'runtime exception';

const defaultState = { data: {}, configuration: {} };

// Log nothing by default
const defaultLogger = createMockLogger();

// TODO doesn't really make sense to pass in a state object to an xplan,
// so maybe state becomes an option in the opts object
const run = (
  expressionOrXPlan: string | Operation[] | ExecutionPlan,
  state: State = defaultState,
  opts: Options = {}
) => {
  const logger = opts.logger || defaultLogger;

  // TODO the plan doesn't have an id, should it be given one?
  // Ditto the jobs?
  let plan: ExecutionPlan;
  if (
    typeof expressionOrXPlan == 'string' ||
    !expressionOrXPlan.hasOwnProperty('jobs')
  ) {
    // Build an execution plan for an incoming expression
    plan = {
      jobs: [
        {
          expression: expressionOrXPlan,
        },
      ],
    } as ExecutionPlan;
    logger.debug('Generated execution plan for incoming expression');
    // TODO how do we sanitise state.config?
    logger.debug(plan);
  } else {
    plan = expressionOrXPlan as ExecutionPlan;
  }

  return executePlan(plan, state, opts, logger);
};

export default run;
