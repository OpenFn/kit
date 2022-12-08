import vm from 'node:vm';
import { createMockLogger, Logger, printDuration } from '@openfn/logger';
import loadModule from './modules/module-loader';
import type { LinkerOptions } from './modules/linker';

export declare interface State<D = object, C = object> {
  configuration: C;
  data: D;
  references?: Array<any>;
  index?: number;
}

export declare interface Operation<T = Promise<State> | State> {
  (state: State): T;
}

type Options = {
  logger?: Logger;
  jobLogger?: Logger;

  // Treat state as immutable (likely to break in legacy jobs)
  immutableState?: boolean;

  // TODO currently unused
  // Ensure that all incoming jobs are sandboxed / loaded as text
  // In practice this means throwing if someone tries to pass live js
  forceSandbox?: boolean;

  linker?: LinkerOptions;
};

type JobModule = {
  operations: Operation[];
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
};

// Log nothing by default
const defaultLogger = createMockLogger();

const defaultState = { data: {}, configuration: {} };

// TODO what if an operation throws?
export default async function run(
  incomingJobs: string | Operation[],
  initialState: State = defaultState,
  opts: Options = {}
) {
  const logger = opts.logger || defaultLogger;
  logger.debug('Intialising pipeline');
  // Setup a shared execution context
  const context = buildContext(initialState, opts);

  const { operations, execute } = await prepareJob(incomingJobs, context, opts);
  // Create the main reducer function
  const reducer = (execute || defaultExecute)(
    ...operations.map((op, idx) =>
      wrapOperation(op, logger, `${idx + 1}`, opts.immutableState)
    )
  );

  // Run the pipeline
  logger.debug(`Executing pipeline (${operations.length} operations)`);
  const result = await reducer(initialState);
  logger.debug('Pipeline complete!');
  logger.debug(result);
  // return the final state
  return result;
}

// TODO I'm in the market for the best solution here - immer? deep-clone?
// What should we do if functions are in the state?
const clone = (state: State) => JSON.parse(JSON.stringify(state));

// Standard execute factory
const defaultExecute = (...operations: Operation[]): Operation => {
  return (state) => {
    const start = Promise.resolve(state);

    return operations.reduce((acc, operation) => {
      return acc.then(operation);
    }, start);
  };
};

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

// Build a safe and helpful execution context
// This will be shared by all operations
// TODO is it possible for one operation to break the npm cache somehow?
const buildContext = (state: State, options: Options) => {
  const logger = options.jobLogger ?? console;

  const context = vm.createContext(
    {
      console: logger,
      state, // TODO I don't really want to pass global state through
      clearInterval,
      clearTimeout,
      parseFloat,
      parseInt,
      setInterval,
      setTimeout,
    },
    {
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    }
  );

  return context;
};

const prepareJob = async (
  jobs: string | Operation[],
  context: vm.Context,
  opts: Options = {}
): Promise<JobModule> => {
  if (typeof jobs === 'string') {
    const exports = await loadModule(jobs, {
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
    return { operations: jobs as Operation[] };
  }
};
