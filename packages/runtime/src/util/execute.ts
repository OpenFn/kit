import type { Operation, State } from '@openfn/lexicon';

// Standard execute factory
export default (...operations: Operation[]): Operation => {
  return (state: State) => {
    const start = Promise.resolve(state);

    return operations.reduce((acc, operation) => {
      return acc.then(operation);
    }, start);
  };
};
