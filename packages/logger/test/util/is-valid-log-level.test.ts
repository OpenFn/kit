import test from 'ava';
import isValidLogLevel from '../../src/util/is-valid-log-level';

test('accepts all log levels in lowercase', (t) => {
  t.true(isValidLogLevel('none'));
  t.true(isValidLogLevel('debug'));
  t.true(isValidLogLevel('info'));
  t.true(isValidLogLevel('default'));
});

test('accepts all log levels in uppercase', (t) => {
  t.true(isValidLogLevel('NONE'));
  t.true(isValidLogLevel('DEBUG'));
  t.true(isValidLogLevel('INFO'));
  t.true(isValidLogLevel('DEFAULT'));
});

test('rejects nonsense values', (t) => {
  t.false(isValidLogLevel('foo'));
  t.false(isValidLogLevel('bar'));
  t.false(isValidLogLevel('success'));
  t.false(isValidLogLevel('error'));
  t.false(isValidLogLevel('warn'));
  t.false(isValidLogLevel('warning'));
});

test('close but not quite', (t) => {
  t.false(isValidLogLevel('xnone'));
  t.false(isValidLogLevel('nonex'));
  t.false(isValidLogLevel('3debug'));
  t.false(isValidLogLevel('3debugl'));
  t.false(isValidLogLevel('1info'));
  t.false(isValidLogLevel('info8'));
  t.false(isValidLogLevel('1default'));
  t.false(isValidLogLevel('default2'));
});
