import vm from 'node:vm';
import { execute } from '@openfn/language-common';
import type { Operation, State } from '@openfn/language-common';

type Options = {
  // TODO should match the console API but this will do for now
  logger?: {
    log: (message: string) => void;
  }
}

const defaultState = { data: {}, configuration: {} };

// TODO I'm in the market for the best solution here
// immer? deep-clone?
// What should we do if functions are in the state?
const clone = (state: State) => JSON.parse(JSON.stringify(state))

// Wrap an operation with various useful stuff
// 1) A runtime exeuction context (possibly sanitised)
// 2) A cloned state object so that prior state is always preserved
// TODO: try/catch stuff
// TODO: automated logging and metrics stuff
const wrap = (fn: Operation, context: vm.Context) => {
  return (state: State) => {
    // Lazily create the contextified function so that it sees the latest context
    const wrappedFn = vm.runInContext(fn.toString(), context);
    const newState = clone(state);
    return wrappedFn(newState);
  }
};


// Build a safe and helpful execution context for the job
// Note that wrapping functions in our own context like this will kill any closures in the original scope
// so you can't do stuff like this:
// const something = "jam";  // abritrary code
// (() => state.x = something); // operation
// However, the compiler could wrap any "loose" top level code into a function
// which would exeecute into the shared context
// and then your closures should basically be available?
// Major difficulty: import statements are also lost in the new contextualisation!
const buildContext = (options: Options) => {
  const logger = options.logger ?? console;
  
  const context = vm.createContext({
    console: logger
  }, {
    codeGeneration: {
      strings: false,
      wasm: false
    }
  });

  return context;
}


async function run(
  jobs: Operation[],
  initialState: State = defaultState,
  options: Options = {}) {
  // Setup a shared execution context
  const context = buildContext(options)

  // Create the main reducer function
  const reducer = execute(...jobs.map((fn) => wrap(fn, context)));

  // Run the job!
  const result = await reducer(initialState);

  // return the final state
  return result;
}

export default run;