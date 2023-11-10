import { Socket as PhxSocket } from 'phoenix';
import { WebSocket } from 'ws';

import generateWorkerToken from '../util/worker-token';
import type { Socket, Channel } from '../types';
import EventEmitter from 'events';

type SocketAndChannel = {
  socket: Socket;
  channel: Channel;
};

// TODO pass a proper logger please
// (this will break tests so I'll do it later)
const connectToWorkerQueue = (
  endpoint: string,
  serverId: string,
  secret: string,
  SocketConstructor = PhxSocket
) => {
  const events = new EventEmitter();

  generateWorkerToken(secret, serverId).then((token) => {
    // @ts-ignore ts doesn't like the constructor here at all
    const socket = new SocketConstructor(endpoint, {
      params: { token },
      transport: WebSocket,
    });

    let didOpen = false;

    // TODO need error & timeout handling (ie wrong endpoint or endpoint offline)
    // Do we infinitely try to reconnect?
    // Consider what happens when the connection drops
    // Unit tests on all of these behaviours!
    socket.onOpen(() => {
      didOpen = true;

      // join the queue channel
      // TODO should this send the worker token?
      const channel = socket.channel('worker:queue') as Channel;

      channel
        .join()
        .receive('ok', () => {
          events.emit('connect', { socket, channel });
        })
        .receive('error', (e: any) => {
          console.log('ERROR', e);
        })
        .receive('timeout', (e: any) => {
          console.log('TIMEOUT', e);
        });
    });

    // On close, the socket will try and reconnect itself
    // Forever, so far as I can tell
    socket.onClose((e: any) => {
      // console.log('SOCKET CLOSED');
      // console.log(e);
      events.emit('disconnect');
    });

    // if we fail to connect, the socket will try to reconnect
    /// forever (?) with backoff
    socket.onError((e: any) => {
      // If we failed to connect, reject the promise
      // The server will try and reconnect itself.s
      if (!didOpen) {
        events.emit('error', e.message);
        didOpen = false;
      }
      // Note that if we DID manage to connect once, the socket should re-negotiate
      // wihout us having to do anything
    });

    socket.connect();
  });

  return events;
};

export default connectToWorkerQueue;
