import type { ExitReasonStrings } from '@openfn/lexicon/lightning';

type IgnoredError = {
  pattern: RegExp; // matches errors to be ignored by sentry
  severity?: ExitReasonStrings;
};

// list of errors here!
export const IGNORED_ERROR_PATTERNS: IgnoredError[] = [
  { pattern: /OAuth token has expired/i, severity: 'crash' },
];

const findIgnoredError = (message?: string | null) => {
  if (!message) {
    return undefined;
  }
  return IGNORED_ERROR_PATTERNS.find(({ pattern }) => pattern.test(message));
};

export const matchesIgnoredError = (message?: string | null): boolean =>
  Boolean(findIgnoredError(message));

export const getIgnoredErrorSeverity = (
  message?: string | null
): ExitReasonStrings | undefined => findIgnoredError(message)?.severity;
