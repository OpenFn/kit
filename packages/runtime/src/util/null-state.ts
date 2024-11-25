const NULL_STATE = Symbol('NullState');

// The good thing about using a Symbol is that even if we forget to clean the object.
// it's still represented as {}, because symbols aren't visible as keys
export function nullState() {
  return { [NULL_STATE]: true };
}

export function isNullState(state: any) {
  return typeof state === 'object' && state[NULL_STATE] === true;
}

export function clearNullState(state: any) {
  if (typeof state === 'object') delete state[NULL_STATE];
}

export function checkAndClearNullState(state: any) {
  const isNull = isNullState(state);
  if (isNull) clearNullState(state);
  return isNull;
}
