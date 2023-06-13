import test from 'ava';
import assembleState from '../../src/util/assemble-state';

// TODO: what if iniitial state or data is not an object?
// Is this an error? Maybe just in strict mode?

test('with no arguments, returns a basic state object', (t) => {
  const initial = undefined;
  const defaultState = undefined;
  const config = undefined;
  const result = assembleState(initial, config, defaultState);
  t.deepEqual(result, {
    configuration: {},
    data: {},
  });
});

test('strict: ignores initial state', (t) => {
  const initial = { x: 22 };
  const defaultState = undefined;
  const config = undefined;
  const result = assembleState(initial, config, defaultState, true);
  t.deepEqual(result, {
    configuration: {},
    data: {},
  });
});

test('strict: ignores initial state except references', (t) => {
  const initial = { references: [] };
  const defaultState = undefined;
  const config = undefined;
  const result = assembleState(initial, config, defaultState, true);
  t.deepEqual(result, {
    references: [],
    configuration: {},
    data: {},
  });
});

test('non-strict: includes initial state', (t) => {
  const initial = { x: 22 };
  const defaultState = undefined;
  const config = undefined;
  const result = assembleState(initial, config, defaultState, false);
  t.deepEqual(result, {
    x: 22,
    configuration: {},
    data: {},
  });
});

test('merges default and initial data objects', (t) => {
  const initial = { data: { x: 1 } };
  const defaultState = { data: { y: 1 } };
  const config = undefined;

  const strict = assembleState(initial, config, defaultState, true);
  t.deepEqual(strict, {
    configuration: {},
    data: {
      x: 1,
      y: 1,
    },
  });

  // Ensure the same behaviour in non-strict mode
  const nonStrict = assembleState(initial, config, defaultState, false);
  t.deepEqual(strict, nonStrict);
});

test('Initial data is prioritised over default data', (t) => {
  const initial = { data: { x: 1 } };
  const defaultState = { data: { x: 2 } };
  const config = undefined;

  const strict = assembleState(initial, config, defaultState, true);
  t.deepEqual(strict, {
    configuration: {},
    data: {
      x: 1,
    },
  });

  const nonStrict = assembleState(initial, config, defaultState, false);
  t.deepEqual(strict, nonStrict);
});

test('merges default and initial config objects', (t) => {
  const initial = { configuration: { x: 1 } };
  const defaultState = undefined;
  const config = { y: 1 };

  const strict = assembleState(initial, config, defaultState, true);
  t.deepEqual(strict, {
    configuration: {
      x: 1,
      y: 1,
    },
    data: {},
  });

  // Ensure the same behaviour in non-strict mode
  const nonStrict = assembleState(initial, config, defaultState, false);
  t.deepEqual(strict, nonStrict);
});

test('configuration overrides initialState.configuration', (t) => {
  const initial = { configuration: { x: 1 } };
  const defaultState = undefined;
  const config = { x: 2 };

  const strict = assembleState(initial, config, defaultState, true);
  t.deepEqual(strict, {
    configuration: {
      x: 2,
    },
    data: {},
  });

  // Ensure the same behaviour in non-strict mode
  const nonStrict = assembleState(initial, config, defaultState, false);
  t.deepEqual(strict, nonStrict);
});
