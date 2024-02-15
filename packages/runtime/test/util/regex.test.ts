import test from 'ava';
import parse from '../../src/util/regex';

test('parse abc', (t) => {
  const re = parse('abc');

  t.true(re instanceof RegExp);

  t.true(re.test('abc'));
  t.true(re.test('123abc123'));
  t.false(re.test('a b c'));
  t.is(re.flags, '');
});

test('parse /abc/', (t) => {
  const re = parse('/abc/');

  t.true(re instanceof RegExp);

  t.true(re.test('abc'));
  t.true(re.test('123abc123'));
  t.false(re.test('a b c'));
  t.is(re.flags, '');
});

test('parse /abc/ig', (t) => {
  const re = parse('/abc/ig');

  t.true(re instanceof RegExp);

  t.true(re.test('ABC'));
  t.true(re.test('123abc123'));
  t.false(re.test('a b c'));
  t.is(re.flags, 'gi');
});

test('parse a/b/c', (t) => {
  const re = parse('a/b/c');

  t.true(re instanceof RegExp);

  t.true(re.test('a/b/c'));
  t.true(re.test('123a/b/c123'));
  t.false(re.test('abc'));
  t.is(re.flags, '');
});

test('parse /a/b/c/i', (t) => {
  const re = parse('/a/b/c/i');

  t.true(re instanceof RegExp);

  t.true(re.test('a/B/c'));
  t.true(re.test('123a/b/c123'));
  t.false(re.test('abc'));
  t.is(re.flags, 'i');
});
