import test from 'ava';
import expandAdaptors from '../../src/util/expand-adaptors';

test('expands common', (t) => {
  const [a] = expandAdaptors(['common']);
  t.is(a, '@openfn/language-common');
});

test('expands common with version', (t) => {
  const [a] = expandAdaptors(['common@1.0.0']);
  t.is(a, '@openfn/language-common@1.0.0');
});

test('expands common with path', (t) => {
  const [a] = expandAdaptors(['common=a/b/c']);
  t.is(a, '@openfn/language-common=a/b/c');
});

test('expands http and dhis2', (t) => {
  const [a, b] = expandAdaptors(['common', 'dhis2']);
  t.is(a, '@openfn/language-common');
  t.is(b, '@openfn/language-dhis2');
});

test('expands nonsense', (t) => {
  const [a] = expandAdaptors(['gn@25~A8fa1']);
  t.is(a, '@openfn/language-gn@25~A8fa1');
});

test('does not expand a full adaptor name', (t) => {
  const [a] = expandAdaptors(['@openfn/language-common']);
  t.is(a, '@openfn/language-common');
});

test('does not expand a full adaptor name with a path', (t) => {
  const [a] = expandAdaptors(['@openfn/language-common=a/b/c']);
  t.is(a, '@openfn/language-common=a/b/c');
});

test('does not expand a simple path', (t) => {
  const [a] = expandAdaptors(['a/b']);
  t.is(a, 'a/b');
});

test('does not expand an absolute path', (t) => {
  const [a] = expandAdaptors(['/a/b/c']);
  t.is(a, '/a/b/c');
});

test('does not expand a js file', (t) => {
  const [a] = expandAdaptors(['my-adaptor.js']);
  t.is(a, 'my-adaptor.js');
});
