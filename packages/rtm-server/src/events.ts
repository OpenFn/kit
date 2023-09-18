// track socket event names as constants to keep refactoring easier

const CLAIM = 'attempt:claim';

// TODO does each worker connect to its own channel, ensuring a private claim steeam?
// or is there a shared Workers channel

// claim reply needs to include the id of the server and the attempt
const CLAIM_REPLY = 'attempt:claim_reply'; // { server_id: 1, attempt_id: 'a1' }


// All attempt events are in a dedicated channel for that event

const ATTEMPT_START = 'attempt:start' // attemptId, timestamp
const ATTEMPT_COMPLETE = 'attempt:complete' // attemptId, timestamp, result, stats
const ATTEMPT_LOG = 'attempt:complete' // level, namespace (job,runtime,adaptor), message, time

// this should not happen - this is "could not execute" rather than "complete with errors"
const ATTEMPT_ERROR = 'attempt:error'