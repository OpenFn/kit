import vm from 'node:vm';
import { execute } from '@openfn/language-common';
import type { Operation, State } from '@openfn/language-common';

import loadModule from './module-loader';

type Options = {
  // TODO should match the console API but this will do for now
  logger?: {
    log: (message: string) => void;
  },

  // TODO currently unused
  // Ensure that all incoming jobs are sandboxed / loaded as text
  // In practice this means throwing if someone tries to pass live js
  forceSandbox?: boolean; 
}

const defaultState = { data: {}, configuration: {} };

export default async function run(
  incomingJobs: string | Operation[],
  initialState: State = defaultState,
  opts: Options = {}) {

    // Setup a shared execution context
  const context = buildContext(opts)
  
  const operations = await prepareJob(incomingJobs, context, opts.forceSandbox);

  // Create the main reducer function
  // TODO we shouldn't import this, we should define our own
  // (but it's nice to prove it works with the original execute implementation)
  const reducer = execute(...operations.map(wrapOperation));

  // Run the job
  const result = await reducer(initialState);

  // return the final state
  return result;
}

// TODO I'm in the market for the best solution here - immer? deep-clone?
// What should we do if functions are in the state?
const clone = (state: State) => JSON.parse(JSON.stringify(state))

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
const buildContext = (options: Options) => {
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
  }, {
    codeGeneration: {
      strings: false,
      wasm: false
    }
  });

  return context;
}

const prepareJob = async (jobs: string | Operation[], context: vm.Context, forceSandbox?: boolean): Promise<Operation[]> => {
  if (typeof jobs === 'string') {
    // Load jobs from a source module string
    return await loadModule(jobs, { context }) as Operation[];
  } else {
    if (forceSandbox) {
      throw new Error("Invalid arguments: jobs must be strings")
    }
    return jobs as Operation[];
  }
}
