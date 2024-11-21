import type { State } from '@openfn/lexicon';
import stringify from 'fast-safe-stringify';

// TODO I'm in the market for the best solution here - immer? deep-clone?
// What should we do if functions are in the state?
export default (state: State) => JSON.parse(stringify(state));
