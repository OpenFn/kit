import test from 'ava';
import { shouldAutoinstall } from '../../src/metadata/handler'

test('should return false when no adaptor is provided', (t) => {
  const adaptor = '';
  const result = shouldAutoinstall(adaptor);
  t.false(result);
});

test('should return false for adaptors with "test=" prefix', (t) => {
  const adaptor = 'test=/repo/modules/test';
  const result = shouldAutoinstall(adaptor);
  t.false(result);
});

test('should return false for adaptors that are full module paths', (t) => {
  const adaptor = '/repo/modules/test';
  const result = shouldAutoinstall(adaptor);
  t.false(result)
});

test('should return true for adaptors with a name', (t) => {
  const adaptor = 'common';
  const result = shouldAutoinstall(adaptor);
  t.true(result);
});

test('should return true for adaptors with a name and version', (t) => {
  const adaptor = '@openfn/language-common@1.0.0';
  const result = shouldAutoinstall(adaptor);
  t.true(result);
});

test('should return false for adaptors that are full paths', (t) => {
  const adaptor = '@openfn/language-common';
  const result = shouldAutoinstall(adaptor);
  t.true(result);
});