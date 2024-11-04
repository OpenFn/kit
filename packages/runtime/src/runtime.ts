import { createMockLogger, Logger } from '@openfn/logger';
import type { ExecutionPlan, State } from '@openfn/lexicon';
import type { ExecutionCallbacks } from './types';
import type { LinkerOptions } from './modules/linker';
import executePlan from './execute/plan';
import { defaultState, parseRegex, clone } from './util/index';

// TODO we should be able to get a proper typing for this from somewherewhere
type SourceMap = any;

export type Options = {
  logger?: Logger;
  jobLogger?: Logger;
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
  statePropsToRemove?: string[];
  defaultRunTimeoutMs?: number;
  sourceMap?: SourceMap;
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
