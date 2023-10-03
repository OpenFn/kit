import phx from 'phoenix-channels';
import generateWorkerToken from '../util/worker-token';
import type { Socket, Channel } from '../types';

type SocketAndChannel = {
  socket: Socket;
  channel: Channel;
};

export const connectToLightning = (
  endpoint: string,
  serverId: string,
  secret: string,
  SocketConstructor: Socket = phx.Socket
) => {
  return new Promise<SocketAndChannel>(async (done, reject) => {
    // TODO does this token need to be fed back anyhow?
    // I think it's just used to connect and then forgotten?
    // If we reconnect we need a new token I guess?
    const token = await generateWorkerToken(secret, serverId);
    const socket = new SocketConstructor(endpoint, { params: { token } });

    // TODO need error & timeout handling (ie wrong endpoint or endpoint offline)
    // Do we infinitely try to reconnect?
    // Consider what happens when the connection drops
    // Unit tests on all of these behaviours!
    socket.onOpen(() => {
      // join the queue channel
      // TODO should this send the worker token?
      const channel = socket.channel('worker:queue');

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

    // TODO what even happens if the connection fails?
    socket.onError((e) => {
      reject(e);
    });

    socket.connect();
  });
};

export default connectToLightning;
