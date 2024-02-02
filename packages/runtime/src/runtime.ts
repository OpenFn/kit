import { createMockLogger, Logger } from '@openfn/logger';
import type { ExecutionPlan, State } from '@openfn/lexicon';
import type { ExecutionCallbacks } from './types';
import type { LinkerOptions } from './modules/linker';
import executePlan from './execute/plan';
import { defaultState, parseRegex, clone } from './util/index';

export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export type Options = {
  logger?: Logger;
  jobLogger?: Logger;

  // TODO: deprecate in this work
  strict?: boolean; // Be strict about handling of state returned from jobs

  // Treat state as immutable (likely to break in legacy jobs)
  immutableState?: boolean;

  // TODO currently unused
  // Ensure that all incoming jobs are sandboxed / loaded as text
  // In practice this means throwing if someone tries to pass live js
  forceSandbox?: boolean;

  linker?: LinkerOptions;

  callbacks?: ExecutionCallbacks;

  // inject globals into the environment
  // TODO leaving this here for now, but maybe its actually on the xplan?
  globals?: any;
};

type RawOptions = Omit<Options, 'linker'> & {
  linker?: Omit<LinkerOptions, 'whitelist'> & {
    whitelist?: Array<RegExp | string>;
  };
};

// Log nothing by default
const defaultLogger = createMockLogger();

const loadPlanFromString = (expression: string, logger: Logger) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          expression,
        },
      ],
    },
    options: {},
  };

  logger.debug('Generated execution plan for incoming expression');
  logger.debug(plan);

  return plan;
};

const run = (
  xplan: Partial<ExecutionPlan> | string,
  input?: State,
  opts: RawOptions = {}
) => {
  const logger = opts.logger || defaultLogger;

  if (typeof xplan === 'string') {
    xplan = loadPlanFromString(xplan, logger);
  }

  if (!xplan.options) {
    xplan.options = {};
  }

  if (!input) {
    input = clone(defaultState);
  }

  const { options } = xplan;

  // TODO remove
  // Strict state handling by default
  if (!opts.hasOwnProperty('strict')) {
    opts.strict = true;
  }

  if (!options.hasOwnProperty('statePropsToRemove')) {
    options.statePropsToRemove = ['configuration'];
  }
  if (opts.linker?.whitelist) {
    opts.linker.whitelist = opts.linker.whitelist.map((w) => {
      if (typeof w === 'string') {
        return parseRegex(w);
      }
      return w;
    });
  }

  return executePlan(xplan as ExecutionPlan, input, opts as Options, logger);
};

export default run;
