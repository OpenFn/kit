import test from 'ava';
import ensureStateSize from '../../src/util/ensure-state-size';
import { StateTooLargeError } from '../../src/errors';

test('do not throw for limit 0kb', async (t) => {
  const state = { data: new Array(1024).fill('z').join('') };
  await t.notThrowsAsync(() => ensureStateSize(state, 0));
});

test('throw for limit 1kb, payload 1kb', async (t) => {
  const state = { data: new Array(1024).fill('z').join('') };
  await t.throwsAsync(() => ensureStateSize(state, 1 / 1024), {
    instanceOf: StateTooLargeError,
    message: 'State exceeds the limit of 0.0009765625mb',
  });
});

test('ok for limit 2kb, payload 1kb', async (t) => {
  const state = { data: new Array(1024).fill('z').join('') };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('allow circular references', async (t) => {
  const state: any = { data: 'test' };
  state.self = state;
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('allow circular references 2', async (t) => {
  const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const state: any = { data: arr, arr };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle promise in state', async (t) => {
  const state = {
    data: 'test',
    promise: new Promise((r) => r),
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle function in state', async (t) => {
  const state = {
    data: 'test',
    fn: () => 'hello',
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle undefined in state', async (t) => {
  const state = {
    data: 'test',
    undef: undefined,
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle symbol in state', async (t) => {
  const state = {
    data: 'test',
    sym: Symbol('test'),
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle BigInt in state', async (t) => {
  const state = {
    data: 'test',
    big: BigInt(123456789),
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle Date in state', async (t) => {
  const state = {
    data: 'test',
    date: new Date('2024-01-01'),
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle RegExp in state', async (t) => {
  const state = {
    data: 'test',
    regex: /test/gi,
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle Map in state', async (t) => {
  const map = new Map();
  map.set('key', 'value');
  const state = {
    data: 'test',
    map: map,
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});

test('handle Set in state', async (t) => {
  const set = new Set([1, 2, 3]);
  const state = {
    data: 'test',
    set: set,
  };
  await t.notThrowsAsync(() => ensureStateSize(state, 2 / 1024));
});
