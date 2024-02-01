// new client connected
export const CONNECT = 'socket:connect';

// client left or joined a channel
export const CHANNEL_JOIN = 'socket:channel-join';
export const CHANNEL_LEAVE = 'socket:channel-leave';

export const CLAIM = 'claim';
export const GET_PLAN = 'fetch:plan';
export const GET_CREDENTIAL = 'fetch:credential';
export const GET_DATACLIP = 'fetch:dataclip';
export const RUN_START = 'run:start';
export const RUN_COMPLETE = 'run:complete';
export const RUN_LOG = 'run:log';
export const STEP_START = 'step:start';
export const STEP_COMPLETE = 'step:complete';
