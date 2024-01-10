import { printDuration, Logger } from '@openfn/logger';
import stringify from 'fast-safe-stringify';
import loadModule from '../modules/module-loader';
import { Operation, JobModule, State, ExecutionContext } from '../types';
import { Options, TIMEOUT } from '../runtime';
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

export type ExecutionErrorWrapper = {
  state: any;
  error: any;
};

export default (
  ctx: ExecutionContext,
  expression: string | Operation[],
  initialState: State
) =>
  new Promise(async (resolve, reject) => {
    let duration = Date.now();
    const { logger, opts = {} } = ctx;
    try {
      const timeout = opts.timeout || TIMEOUT;

      logger.debug('Intialising pipeline');
      logger.debug(`Timeout set to ${timeout}ms`);

      // Setup an execution context
      const context = buildContext(initialState, opts);

      const { operations, execute } = await prepareJob(
        expression,
        context,
        opts
      );
      // Create the main reducer function
      const reducer = (execute || defaultExecute)(
        ...operations.map((op, idx) =>
          wrapOperation(op, logger, `${idx + 1}`, opts.immutableState)
        )
      );

      // Run the pipeline
      logger.debug(`Executing expression (${operations.length} operations)`);

      const tid = setTimeout(() => {
        logger.error(`Error: Timeout (${timeout}ms) expired!`);
        logger.error('  Set a different timeout by passing "-t 10000" ms)');
        reject(new TimeoutError(timeout));
      }, timeout);

      // Note that any errors will be trapped by the containing Job
      const result = await reducer(initialState);

      clearTimeout(tid);
      logger.debug('Expression complete!');

      duration = Date.now() - duration;

      const finalState = prepareFinalState(opts, result, logger);
      // return the final state
      resolve(finalState);
    } catch (e: any) {
      // whatever initial state looks like now, clean it and report it back
      const finalState = prepareFinalState(opts, initialState, logger);
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
    logger.info(`Operation ${name} complete in ${duration}`);
    return result;
  };
};

const prepareJob = async (
  expression: string | Operation[],
  context: Context,
  opts: Options = {}
): Promise<JobModule> => {
  if (typeof expression === 'string') {
    const exports = await loadModule(expression, {
      ...opts.linker,
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

const assignKeys = (
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  keys: string[]
) => {
  keys.forEach((k) => {
    if (source.hasOwnProperty(k)) {
      target[k] = source[k];
    }
  });
  return target;
};

// TODO this is suboptimal and may be slow on large objects
// (especially as the result get stringified again downstream)
const prepareFinalState = (opts: Options, state: any, logger: Logger) => {
  if (state) {
    if (opts.statePropsToRemove && opts.statePropsToRemove.length) {
      opts.statePropsToRemove.forEach((prop) => {
        if (state.hasOwnProperty(prop)) {
          delete state[prop];
          logger.debug(`Removed ${prop} from final state`);
        }
      });
    }
    if (opts.strict) {
      state = assignKeys(state, {}, ['data', 'error', 'references']);
    } else if (opts.deleteConfiguration !== false) {
      delete state.configuration;
    }
    const cleanState = stringify(state);
    return JSON.parse(cleanState);
  }
  return state;
};
