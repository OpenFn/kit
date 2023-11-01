import { Socket as PhxSocket } from 'phoenix';
import { WebSocket } from 'ws';

import generateWorkerToken from '../util/worker-token';
import type { Socket, Channel } from '../types';

type SocketAndChannel = {
  socket: Socket;
  channel: Channel;
};

const connectToWorkerQueue = (
  endpoint: string,
  serverId: string,
  secret: string,
  SocketConstructor = PhxSocket
) => {
  return new Promise<SocketAndChannel>(async (done, reject) => {
    // TODO does this token need to be fed back anyhow?
    // I think it's just used to connect and then forgotten?
    // If we reconnect we need a new token I guess?
    const token = await generateWorkerToken(secret, serverId);
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
          done({ socket, channel });
        })
        .receive('error', (e: any) => {
          console.log('ERROR', e);
        })
        .receive('timeout', (e: any) => {
          console.log('TIMEOUT', e);
        });
    });

    // if we fail to connect
    socket.onError((e: any) => {
      // If we failed to connect, reject the promise
      // The server will try and reconnect itself.s
      if (!didOpen) {
        reject(e);
      }
      // Note that if we DID manage to connect once, the socket should re-negotiate
      // wihout us having to do anything
    });

    socket.connect();
  });
};

export default connectToWorkerQueue;
