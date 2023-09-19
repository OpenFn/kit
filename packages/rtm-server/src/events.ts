// track socket event names as constants to keep refactoring easier

export const CLAIM = 'attempt:claim';

// TODO does each worker connect to its own channel, ensuring a private claim steeam?
// or is there a shared Workers channel

// claim reply needs to include the id of the server and the attempt
export const CLAIM_REPLY = 'attempt:claim_reply'; // { server_id: 1, attempt_id: 'a1' }

// All attempt events are in a dedicated channel for that event

// or attempt_get ? I think there are several getters so maybe this makes sense
export const GET_ATTEMPT = 'fetch:attempt';

export const ATTEMPT_START = 'attempt:start'; // attemptId, timestamp
export const ATTEMPT_COMPLETE = 'attempt:complete'; // attemptId, timestamp, result, stats
export const ATTEMPT_LOG = 'attempt:complete'; // level, namespace (job,runtime,adaptor), message, time

// this should not happen - this is "could not execute" rather than "complete with errors"
export const ATTEMPT_ERROR = 'attempt:error';
