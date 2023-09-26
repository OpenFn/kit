// track socket event names as constants to keep refactoring easier

export const CLAIM = 'attempt:claim';
// this is the lightning payload
export type CLAIM_PAYLOAD = { demand?: number };
export type CLAIM_REPLY_PAYLOAD = Array<{ id: string; token?: string }>;

export const GET_ATTEMPT = 'fetch:attempt';
export type GET_ATTEMPT_PAYLOAD = undefined; // no payload

export const GET_CREDENTIAL = 'fetch:credential';
// export type GET_CREDENTIAL_PAYLOAD =

export const GET_DATACLIP = 'fetch:dataclip';
// export type GET_DATACLIP_PAYLOAD =

export const ATTEMPT_START = 'attempt:start'; // attemptId, timestamp
export const ATTEMPT_COMPLETE = 'attempt:complete'; // attemptId, timestamp, result, stats
export const ATTEMPT_LOG = 'attempt:log'; // level, namespace (job,runtime,adaptor), message, time

// this should not happen - this is "could not execute" rather than "complete with errors"
export const ATTEMPT_ERROR = 'attempt:error';

export const RUN_START = 'run:start';
export const RUN_COMPLETE = 'run:complete';

// TODO I'd like to create payload type for each event, so that we have a central definition
