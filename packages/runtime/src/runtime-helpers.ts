/**
 * Helper functions designed to be used in job code
 */

import { State } from '@openfn/lexicon';

// Defer will take an operation with a promise chain
// and break it up into a deferred function call which
// ensures the operation is a promise
// eg, fn().then(s => s)

// TODO move unit tests in here
export function defer(
  fn: (s: State) => State,
  complete = (p: Promise<any>) => p,
  error = (e: any, _state: State): void => {
    throw e;
  }
) {
  return (state: State) => {
    try {
      return complete(Promise.resolve(fn(state)).catch((e) => error(e, state)));
    } catch (e) {
      return error(e, state);
    }
  };
}
