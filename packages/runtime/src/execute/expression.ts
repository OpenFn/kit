import { printDuration, Logger } from '@openfn/logger';
import loadModule from '../modules/module-loader';
import { Operation, Options, JobModule, State } from '../types';
import { ERR_TIMEOUT, ERR_RUNTIME_EXCEPTION, TIMEOUT } from '../runtime';
import buildContext, { Context } from './context';
import defaultExecute from '../util/execute';
import clone from '../util/clone';

export default (
  expression: string | Operation[],
  initialState: State,
  logger: Logger,
  opts: Options = {}
) =>
  new Promise(async (resolve, reject) => {
    const timeout = opts.timeout || TIMEOUT;
    logger.debug('Intialising pipeline');
    logger.debug(`Timeout set to ${timeout}ms`);

    // Setup a shared execution context
    const context = buildContext(initialState, opts);

    const { operations, execute } = await prepareJob(expression, context, opts);
    // Create the main reducer function
    const reducer = (execute || defaultExecute)(
      ...operations.map((op, idx) =>
        wrapOperation(op, logger, `${idx + 1}`, opts.immutableState)
      )
    );

    // Run the pipeline
    logger.debug(`Executing pipeline (${operations.length} operations)`);

    const tid = setTimeout(() => {
      logger.error(`Error: Timeout (${timeout}ms) expired!`);
      logger.error('  Set a different timeout by passing "-t 10000" ms)');
      reject(Error(ERR_TIMEOUT));
    }, timeout);

    try {
      const result = await reducer(initialState);
      clearTimeout(tid);
      logger.debug('Pipeline complete!');
      logger.debug(result);
      // return the final state
      resolve(result);
    } catch (e: any) {
      // Note: e will be some kind of serialized error object and not an instance of Error
      // See https://github.com/OpenFn/kit/issues/143
      logger.error('Error in runtime execution!');
      if (e.toString) {
        logger.error(e.toString());
      }
      reject(new Error(ERR_RUNTIME_EXCEPTION));
    }
  });

// Wrap an operation with various useful stuff
// * A cloned state object so that prior state is always preserved
// TODO: try/catch stuff
// TODO: automated logging and metrics stuff
const wrapOperation = (
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
    const duration = printDuration(new Date().getTime() - start);
    logger.success(`Operation ${name} complete in ${duration}`);
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
      throw new Error('Invalid arguments: jobs must be strings');
    }
    return { operations: expression as Operation[] };
  }
};
