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
