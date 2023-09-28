export const ATTEMPT_PREFIX = 'attempt:';

export const extractAttemptId = (topic: string) =>
  topic.substr(ATTEMPT_PREFIX.length);
