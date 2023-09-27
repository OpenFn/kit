import phx from 'phoenix-channels';
import { Channel } from '../types';

type SocketAndChannel = {
  socket: phx.Socket;
  channel: Channel;
};

// This will open up a websocket channel to lightning
// TODO auth
export const connectToLightning = (
  endpoint: string,
  _serverId: string,
  Socket = phx.Socket
) => {
  return new Promise<SocketAndChannel>((done) => {
    let socket = new Socket(endpoint /*,{params: {userToken: "123"}}*/);

    // TODO need error & timeout handling (ie wrong endpoint or endpoint offline)
    // Do we infinitely try to reconnect?
    // Consider what happens when the connection drops
    // Unit tests on all of these behaviours!
    socket.onOpen(() => {
      // join the queue channel
      const channel = socket.channel('attempts:queue');

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

    socket.connect();
  });
};

export default connectToLightning;
