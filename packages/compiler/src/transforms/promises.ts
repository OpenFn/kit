type State = any;

// Defer will take an operation with a promise chain
// and break it up into a deferred function call which
// ensures the operation is a promise
// eg, fn().then(s => s)
// TODO what about
// eg, fn().then(s => s).then(s => s)

// TODO not a huge fan of how this stringifies
// maybe later update tsconfig

// TODO if the complete function errors, what do we do?
// This should Just Work right?
// eg, fn().then(s => s).catch()
export function defer(
  fn: (s: State) => State,
  complete = (s: State) => s,
  error = (e: any): void => {
    throw e;
  }
) {
  return (state: State) => {
    try {
      return Promise.resolve(fn(state)).catch(error).then(complete);
    } catch (e) {
      error(e);
    }
  };
}

const DEFER_SOURCE = defer.toString();



export default {
  id: 'lazy-state',
  types: ['MemberExpression'],
  visitor,
  // It's important that $ symbols are escaped before any other transformations can run
  order: 0,
} as Transformer;
