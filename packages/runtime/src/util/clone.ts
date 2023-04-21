import type { State } from '../types';

// TODO I'm in the market for the best solution here - immer? deep-clone?
// What should we do if functions are in the state?
export default (state: State) => JSON.parse(JSON.stringify(state));
