import test from 'ava';
import expandAdaptors from '../../src/util/expand-adaptors';
import { createMockLogger } from '@openfn/logger';

test('expands common', (t) => {
  const [a] = expandAdaptors(['common']);
  t.is(a, '@openfn/language-common');
});

test('expands common with version', (t) => {
  const [a] = expandAdaptors(['common@1.0.0']);
  t.is(a, '@openfn/language-common@1.0.0');
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

test('logs if it expands', (t) => {
  const logger = createMockLogger('', { level: 'info' });
  const [a] = expandAdaptors(['common'], logger);
  t.is(a, '@openfn/language-common');

  const { message } = logger._parse(logger._last);
  t.assert(/^Expanded adaptor/.test(message as string));
});

test('do not log if it does not expand', (t) => {
  const logger = createMockLogger('', { level: 'info' });
  const [a] = expandAdaptors(['@openfn/language-common'], logger);

  t.is(a, '@openfn/language-common');
  t.is(logger._history.length, 0);
});
