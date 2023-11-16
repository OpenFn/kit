import createLightningServer from '../src/server';

import { Socket } from 'phoenix';
import { WebSocket } from 'ws';

export const setup = (port: number) => {
  return new Promise<{ server: any; client: any }>((done) => {
    const server = createLightningServer({ port });

    // Note that we need a token to connect, but the mock here
    // doesn't (yet) do any validation on that token
    const client = new Socket(`ws://localhost:${port}/worker`, {
      params: { token: 'x.y.z' },
      timeout: 1000 * 120,
      transport: WebSocket,
    });
    client.onOpen(() => {
      done({ server, client });
    });
    client.connect();
  });
};
