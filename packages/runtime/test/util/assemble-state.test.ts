import test from 'ava';
import assembleState from '../../src/util/assemble-state';

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

test('includes initial state', (t) => {
  const initial = { x: 22 };
  const defaultState = undefined;
  const config = undefined;

  const result = assembleState(initial, config, defaultState);
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

  const result = assembleState(initial, config, defaultState);
  t.deepEqual(result, {
    configuration: {},
    data: {
      x: 1,
      y: 1,
    },
  });
});

test('Initial data is prioritised over default data', (t) => {
  const initial = { data: { x: 1 } };
  const defaultState = { data: { x: 2 } };
  const config = undefined;

  const result = assembleState(initial, config, defaultState);
  t.deepEqual(result, {
    configuration: {},
    data: {
      x: 1,
    },
  });
});

test('Initial data does not have to be an object', (t) => {
  const initial = { data: [1] };
  const defaultState = { data: {} };
  const config = undefined;

  const result = assembleState(initial, config, defaultState);
  t.deepEqual(result, {
    configuration: {},
    data: [1],
  });
});

test('merges default and initial config objects', (t) => {
  const initial = { configuration: { x: 1 } };
  const defaultState = undefined;
  const config = { y: 1 };

  const result = assembleState(initial, config, defaultState);
  t.deepEqual(result, {
    configuration: {
      x: 1,
      y: 1,
    },
    data: {},
  });
});

test('configuration overrides initialState.configuration', (t) => {
  const initial = { configuration: { x: 1 } };
  const defaultState = undefined;
  const config = { x: 2 };

  const result = assembleState(initial, config, defaultState);
  t.deepEqual(result, {
    configuration: {
      x: 2,
    },
    data: {},
  });
});

test('initialState.configuration is preserved', (t) => {
  const initial = { configuration: { x: 1 } };
  const defaultState = undefined;
  const config = undefined;

  const result = assembleState(initial, config, defaultState);
  t.deepEqual(result, {
    configuration: {
      x: 1,
    },
    data: {},
  });
});

test('global credentials should be added', (t) => {
  const initial = {};
  const defaultState = undefined;
  const config = undefined;
  const global = { collection_token: 'j.w.t' };

  const result = assembleState(initial, config, defaultState, global);
  t.deepEqual(result, {
    configuration: {
      collection_token: 'j.w.t',
    },
    data: {},
  });
});

test('global credentials should be merged in', (t) => {
  const initial = { configuration: { x: 1 } };
  const defaultState = undefined;
  const config = { x: 2 };
  const global = { collection_token: 'j.w.t' };

  const result = assembleState(initial, config, defaultState, global);
  t.deepEqual(result, {
    configuration: {
      x: 2,
      collection_token: 'j.w.t',
    },
    data: {},
  });
});

test('local credentials should override global credentials', (t) => {
  const initial = { configuration: {} };
  const defaultState = undefined;
  const config = { collection_token: 'x.y.z' };
  const global = { collection_token: 'j.w.t' };

  const result = assembleState(initial, config, defaultState, global);
  t.deepEqual(result, {
    configuration: {
      collection_token: 'x.y.z',
    },
    data: {},
  });
});

test('local credentials should override global credentials but still preserve intial credentials', (t) => {
  const initial = { configuration: { x: 1 } };
  const defaultState = undefined;
  const config = { collection_token: 'x.y.z' };
  const global = { collection_token: 'j.w.t' };

  const result = assembleState(initial, config, defaultState, global);
  t.deepEqual(result, {
    configuration: {
      x: 1,
      collection_token: 'x.y.z',
    },
    data: {},
  });
});
