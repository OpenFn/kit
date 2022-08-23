import type { Operation, State } from '@openfn/language-common';
import { json } from 'stream/consumers';

type Obj = Record<string, unknown>;

const defaultState = { data: {}, configuration: {} };

// type Opts = {
//   logger: any; // path to module or an actual object?
// }

// TODO I'm in the market for the best solution here
// immer? deep-clone?
// What should we do if functions are in the state?
const clone = (state: State) => JSON.parse(JSON.stringify(state))

// Copied from language-common
export function execute(...operations: Array<Operation>): Operation {
  return state => {
    const start = Promise.resolve(state);

    return operations.reduce((acc, operation) => {
      return acc.then(operation);
    }, start);
  };
}

const wrapFn = (fn: Operation) => {
  return (state: State) => {
    const newState = clone(state);
    return fn(newState);
  }
};


// this is presumably async?
async function run(jobs: Operation[], initialState: State = defaultState) {
  // Can I re-use execute or do I need to write my own?
  // nice to prove the principal with the core loop...
  // TODO how do we inject into state?
  const reducer = execute(...jobs.map(wrapFn));
  const result = await reducer(initialState);
  return result;
}

export default run;