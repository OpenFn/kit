import vm from 'node:vm';

import loadModule from './modules/module-loader';
import { LinkerOptions } from './modules/linker';

type Options = {
  // TODO should match the console API but this will do for now
  logger?: {
    log: (message: string) => void;
  },

  // TODO currently unused
  // Ensure that all incoming jobs are sandboxed / loaded as text
  // In practice this means throwing if someone tries to pass live js
  forceSandbox?: boolean; 

  linker?: LinkerOptions;
}

type JobModule = {
  operations: Operation[],
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
}


const defaultState = { data: {}, configuration: {} };

// TODO what if an operation throws?
export default async function run(
  incomingJobs: string | Operation[],
  initialState: State = defaultState,
  opts: Options = {}) {

  // Setup a shared execution context
  const context = buildContext(initialState, opts)
  
  const { operations, execute } = await prepareJob(incomingJobs, context, opts);
  // Create the main reducer function
  const reducer = (execute || defaultExecute)(...operations.map(wrapOperation));

  // Run the pipeline
  const result = await reducer(initialState);

  // return the final state
  return result;
}

// TODO I'm in the market for the best solution here - immer? deep-clone?
// What should we do if functions are in the state?
const clone = (state: State) => JSON.parse(JSON.stringify(state))

// Standard execute factory
const defaultExecute = (...operations: Operation[]): Operation => {
  return state => {
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
const wrapOperation = (fn: Operation) => {
  return (state: State) => {
    const newState = clone(state);
    return fn(newState);
  }
};

// Build a safe and helpful execution context
// This will be shared by all operations
// TODO is it possible for one operation to break the npm cache somehow?
const buildContext = (state: State, options: Options) => {
  const logger = options.logger ?? console;
  
  const context = vm.createContext({
    console: logger,
    // TODO take a closer look at what globals to pass through
    clearInterval,
    clearTimeout,
    JSON,
    parseFloat,
    parseInt,
    setInterval,
    setTimeout,
    state, // TODO I don't really want to pass global state through
  }, {
    codeGeneration: {
      strings: false,
      wasm: false
    }
  });

  return context;
}

const prepareJob = async (jobs: string | Operation[], context: vm.Context, opts: Options = {}): Promise<JobModule> => {
  if (typeof jobs === 'string') {
    const exports =  await loadModule(jobs, { ...opts.linker, context });
    const operations = exports.default;
    return {
      operations,
      ...exports
    } as JobModule;
  } else {
    if (opts.forceSandbox) {
      throw new Error("Invalid arguments: jobs must be strings")
    }
    return { operations: jobs as Operation[] }
  }
}
