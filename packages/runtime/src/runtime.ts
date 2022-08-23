import type { Operation, State } from '@openfn/language-common';

type Obj = Record<string, unknown>;

const defaultState = { data: {}, configuration: {} };

// type Opts = {
//   logger: any; // path to module or an actual object?
// }

// Copied from language-common
export function execute(...operations: Array<Operation>): Operation {
  return state => {
    const start = Promise.resolve(state);

    return operations.reduce((acc, operation) => {
      return acc.then(operation);
    }, start);
  };
}


// this is presumably async?
async function run(jobs: Operation[], initialState: State = defaultState) {
  // Can I re-use execute or do I need to write my own?
  // nice to prove the principal with the core loop...
  // TODO how do we inject into state?
  console.log('run')
  const reducer = execute(...jobs);
  const result = await reducer(initialState);
  return result;
}

export default run;