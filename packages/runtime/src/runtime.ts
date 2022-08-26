import vm from 'node:vm';
import { execute } from '@openfn/language-common';
import type { Operation, State } from '@openfn/language-common';

import loadModule from './module-loader';

type Options = {
  // TODO should match the console API but this will do for now
  logger?: {
    log: (message: string) => void;
  },
  // How should the runtime interpret the source input?
  // As a path to an module, an esm string or live js?
  // Defaults to an esm string I guess
  // Actually, I think module loading is outside the runtime's scope
  // The runtime manager can load and pass modules as strings
  // Let's say that for now
  //eval?: 'esm-path' | 'esm-string' | 'none';
  eval?: 'string' | 'none',

  // Ensure that all incoming jobs are sandboxed
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
  
  const jobs = await initJobs(incomingJobs, context, opts.forceSandbox);

  // Create the main reducer function
  // TODO we shouldn't import this, we should define our own
  // (but it's nice to prove it works with the original execute implementation)
  const reducer = execute(...jobs.map(runOperation));

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
const runOperation = (fn: Operation) => {
  return (state: State) => {
    const newState = clone(state);
    return fn(newState);
  }
};

// Build a safe and helpful execution context
// This will be shared by all operations
const buildContext = (options: Options) => {
  const logger = options.logger ?? console;
  
  const context = vm.createContext({
    console: logger,
    // TODO we need to keep a whole bunch of globals really
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

const initJobs = async (jobs: string | Operation[], context: vm.Context, forceSandbox?: boolean): Promise<Operation[]> => {
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
