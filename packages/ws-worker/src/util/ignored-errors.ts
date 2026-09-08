import type { ExitReasonStrings } from '@openfn/lexicon/lightning';

type IgnoredError = {
  pattern: RegExp; // matches errors to be ignored by sentry
  severity?: ExitReasonStrings;
};

// list of errors here!
export const IGNORED_ERROR_PATTERNS: IgnoredError[] = [
  { pattern: /OAuth token has expired/i, severity: 'crash' },
  // Raised when a project's environment has no matching credential
  // environment. A configuration mistake for the user to fix, not a worker
  // fault, and the message already tells them how to fix it.
  { pattern: /Credential environment mismatch/i },
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
