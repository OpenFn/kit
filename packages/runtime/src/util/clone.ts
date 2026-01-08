import type { State } from '@openfn/lexicon';
import stringify from 'fast-safe-stringify';

export default (state: State) => JSON.parse(stringify(state));
