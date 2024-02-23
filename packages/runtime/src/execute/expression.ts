import { printDuration, Logger } from '@openfn/logger';
import stringify from 'fast-safe-stringify';
import type { Operation, State } from '@openfn/lexicon';

import loadModule from '../modules/module-loader';
import { Options, DEFAULT_TIMEOUT_MS } from '../runtime';
import buildContext, { Context } from './context';
import defaultExecute from '../util/execute';
import clone from '../util/clone';
import {
  InputError,
  TimeoutError,
  JobError,
  assertAdaptorError,
  assertImportError,
  assertRuntimeCrash,
  assertRuntimeError,
  assertSecurityKill,
} from '../errors';
import type { JobModule, ExecutionContext } from '../types';
import { ModuleInfoMap } from '../modules/linker';

export type ExecutionErrorWrapper = {
  state: any;
  error: any;
};

// TODO don't send the whole context because it's a bit confusing - just the options maybe?
export default (
  ctx: ExecutionContext,
  expression: string | Operation[],
  input: State,
  // allow custom linker options to be passed for this step
  // this lets us use multiple versions of the same adaptor in a workflow
  moduleOverrides?: ModuleInfoMap
) =>
  new Promise(async (resolve, reject) => {
    let duration = Date.now();
    const { logger, plan, opts = {} } = ctx;
    try {
      const timeout = plan.options?.timeout ?? DEFAULT_TIMEOUT_MS;

      // Setup an execution context
      const context = buildContext(input, opts);

      const { operations, execute } = await prepareJob(
        expression,
        context,
        opts,
        moduleOverrides
      );
      // Create the main reducer function
      const reducer = (execute || defaultExecute)(
        ...operations.map((op, idx) =>
          wrapOperation(op, logger, `${idx + 1}`, opts.immutableState)
        )
      );

      // Run the pipeline
      let tid;
      logger.debug(`Executing expression (${operations.length} operations)`);
      if (timeout) {
        logger.debug(`Timeout set to ${timeout}ms`);

        tid = setTimeout(() => {
          logger.error(`Error: Timeout expired (${timeout}ms)`);
          reject(new TimeoutError(timeout));
        }, timeout);
      }

      // Note that any errors will be trapped by the containing Job
      const result = await reducer(input);

      clearTimeout(tid);
      logger.debug('Expression complete!');

      duration = Date.now() - duration;

      const finalState = prepareFinalState(
        result,
        logger,
        opts.statePropsToRemove
      );
      // return the final state
      resolve(finalState);
    } catch (e: any) {
      // whatever initial state looks like now, clean it and report it back
      const finalState = prepareFinalState(
        input,
        logger,
        opts.statePropsToRemove
      );
      duration = Date.now() - duration;
      let finalError;
      try {
        assertImportError(e);
        assertRuntimeError(e);
        assertRuntimeCrash(e);
        assertSecurityKill(e);
        assertAdaptorError(e);
        finalError = new JobError(e);
      } catch (e) {
        finalError = e;
      }

      reject({ state: finalState, error: finalError } as ExecutionErrorWrapper);
    }
  });

// Wrap an operation with various useful stuff
export const wrapOperation = (
  fn: Operation,
  logger: Logger,
  name: string,
  immutableState?: boolean
) => {
  return async (state: State) => {
    logger.debug(`Starting operation ${name}`);
    const start = new Date().getTime();
    const newState = immutableState ? clone(state) : state;
    const result = await fn(newState);
    // TODO should we warn if an operation does not return state?
    // the trick is saying WHICH operation without source mapping
    const duration = printDuration(new Date().getTime() - start);
    logger.debug(`Operation ${name} complete in ${duration}`);
    return result;
  };
};

export const mergeLinkerOptions = (
  options: ModuleInfoMap = {},
  overrides: ModuleInfoMap = {}
) => {
  const opts: ModuleInfoMap = {};
  for (const specifier in options) {
    opts[specifier] = options[specifier];
  }
  for (const specifier in overrides) {
    opts[specifier] = Object.assign({}, opts[specifier], overrides[specifier]);
  }
  return opts;
};

const prepareJob = async (
  expression: string | Operation[],
  context: Context,
  opts: Options = {},
  moduleOverrides: ModuleInfoMap = {}
): Promise<JobModule> => {
  if (typeof expression === 'string') {
    const exports = await loadModule(expression, {
      ...opts.linker,
      // allow module paths and versions to be overriden from the defaults
      modules: mergeLinkerOptions(opts.linker?.modules, moduleOverrides),
      context,
      log: opts.logger,
    });
    const operations = exports.default;
    return {
      operations,
      ...exports,
    } as JobModule;
  } else {
    if (opts.forceSandbox) {
      throw new InputError('Invalid arguments: jobs must be strings');
    }
    return { operations: expression as Operation[] };
  }
};

// TODO this is suboptimal and may be slow on large objects
// (especially as the result get stringified again downstream)
const prepareFinalState = (
  state: any,
  logger: Logger,
  statePropsToRemove?: string[]
) => {
  if (state) {
    if (!statePropsToRemove) {
      // As a strict default, remove the configuration key
      // tbh this should happen higher up in the stack but it causes havoc in unit testing
      statePropsToRemove = ['configuration'];
    }

    statePropsToRemove.forEach((prop) => {
      if (state.hasOwnProperty(prop)) {
        delete state[prop];
        logger.debug(`Removed ${prop} from final state`);
      }
    });

    const cleanState = stringify(state);
    return JSON.parse(cleanState);
  }
  return state;
};
