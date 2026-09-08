import test from 'ava';

import {
  getIgnoredErrorSeverity,
  matchesIgnoredError,
} from '../../src/util/ignored-errors';

test('matches an expired OAuth token', (t) => {
  t.true(matchesIgnoredError('OAuth token has expired'));
});

test('matches a credential environment mismatch', (t) => {
  const message = `[fetch:credential] Credential environment mismatch.
This project is using 'geda' but credential 'Pius Git Token' does not have a matching environment.`;

  t.true(matchesIgnoredError(message));
});

test('matches regardless of case', (t) => {
  t.true(matchesIgnoredError('credential ENVIRONMENT Mismatch'));
});

test('does not match an unrelated error', (t) => {
  t.false(matchesIgnoredError('Something else went wrong'));
});

test('does not match empty or nullish input', (t) => {
  t.false(matchesIgnoredError(''));
  t.false(matchesIgnoredError(null));
  t.false(matchesIgnoredError(undefined));
});

test('reports the severity override for an expired OAuth token', (t) => {
  t.is(getIgnoredErrorSeverity('OAuth token has expired'), 'crash');
});

test('leaves the exit reason alone for a credential environment mismatch', (t) => {
  t.is(getIgnoredErrorSeverity('Credential environment mismatch'), undefined);
});

test('reports no severity for an unmatched error', (t) => {
  t.is(getIgnoredErrorSeverity('Something else went wrong'), undefined);
});
