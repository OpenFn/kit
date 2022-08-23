import { execute } from '@openfn/language-common';
import type { Operation, State } from '@openfn/language-common';

const defaultState = { data: {}, configuration: {} };

// TODO I'm in the market for the best solution here
// immer? deep-clone?
// What should we do if functions are in the state?
const clone = (state: State) => JSON.parse(JSON.stringify(state))


const wrapFn = (fn: Operation) => {
  return (state: State) => {
    const newState = clone(state);
    return fn(newState);
  }
};


async function run(jobs: Operation[], initialState: State = defaultState) {
  const reducer = execute(...jobs.map(wrapFn));
  const result = await reducer(initialState);
  return result;
}

export default run;