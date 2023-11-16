/**
 * These events are copied out of ws-worker
 * There is a danger of them diverging
 */

// TODO yeah for sure we need to remove these from here. Use the worker's types.

// new client connected
export const CONNECT = 'socket:connect';

// client left or joined a channel
export const CHANNEL_JOIN = 'socket:channel-join';
export const CHANNEL_LEAVE = 'socket:channel-leave';

export const CLAIM = 'claim';
export const GET_ATTEMPT = 'fetch:attempt';
export const GET_CREDENTIAL = 'fetch:credential';
export const GET_DATACLIP = 'fetch:dataclip';
export const ATTEMPT_START = 'attempt:start';
export const ATTEMPT_COMPLETE = 'attempt:complete';
export const ATTEMPT_LOG = 'attempt:log';
export const RUN_START = 'run:start';
export const RUN_COMPLETE = 'run:complete';
