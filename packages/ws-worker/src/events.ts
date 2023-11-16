export const CLAIM = 'claim';

export const GET_ATTEMPT = 'fetch:attempt';

export const GET_CREDENTIAL = 'fetch:credential';

export const GET_DATACLIP = 'fetch:dataclip';

export const ATTEMPT_START = 'attempt:start'; // attemptId, timestamp

export const ATTEMPT_COMPLETE = 'attempt:complete'; // attemptId, timestamp, result, stats

export const ATTEMPT_LOG = 'attempt:log'; // level, namespace (job,runtime,adaptor), message, time
export const RUN_START = 'run:start';

export const RUN_COMPLETE = 'run:complete';
