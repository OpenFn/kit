import test from 'ava';
import duration from '../../src/util/duration';

test('reports 1ms in ms', (t) => {
  t.is(duration(1), '1ms');
});

test('reports 999ms in ms', (t) => {
  t.is(duration(999), '999ms');
});

test('reports 1000ms in seconds', (t) => {
  t.is(duration(1000), '1s');
});

test(`reports ${1000 * 60 - 1}ms in seconds`, (t) => {
  t.is(duration(1000 * 60 - 1), '59.999s');
});

test(`reports ${1000 * 60}ms in minutes and seconds`, (t) => {
  t.is(duration(1000 * 60), '1m 0s');
});

test(`reports ${1000 * 61}ms in minutes and seconds`, (t) => {
  t.is(duration(1000 * 61), '1m 1s');
});

test(`reports ${1000 * 60 * 5.5}ms in minutes and seconds`, (t) => {
  t.is(duration(1000 * 60 * 5.5), '5m 30s');
});
