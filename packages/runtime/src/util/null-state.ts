// This module manages a special state object with a hidden null symbol.
// Used to track when operations and jobs do not return their own state

const NULL_STATE = Symbol('null_state');

// The good thing about using a Symbol is that even if we forget to clean the object.
// it's still represented as {}, because symbols aren't visible as keys
export function createNullState() {
  return { [NULL_STATE]: true };
}

export function isNullState(state: any) {
  return typeof state === 'object' && state[NULL_STATE] === true;
}

export function clearNullState(state: any) {
  if (typeof state === 'object') delete state[NULL_STATE];
}
