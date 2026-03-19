import { Socket } from 'phoenix';
import { WebSocket } from 'ws';
import crypto from 'node:crypto';

import createLightningServer from '../src/server';
import type { DevServer } from '../src/types';
import { runs } from './data';

type Channel = any; // TODO

export const setup = (port: number) => {
  return new Promise<{
    server: DevServer;
    client: any;
    close: () => Promise<void>;
  }>((done) => {
    const server = createLightningServer({ port });
    // Note that we need a token to connect, but the mock here
    // doesn't (yet) do any validation on that token
    const client = new Socket(`ws://localhost:${port}/worker`, {
      params: { token: 'x.y.z' },
      timeout: 1000 * 120,
      transport: WebSocket,
    });

    const close = async () => {
      await server.destroy();
      // // Let one I/O tick pass so the client socket transitions to readyState
      // // CLOSED before Phoenix's waitForSocketClosed check, avoiding its
      // // 150ms polling loop that otherwise keeps the worker process alive.
      // await new Promise((r) => setImmediate(r));
      client.disconnect();
    };

    client.onOpen(() => {
      done({ server, client, close });
    });
    client.connect();
  });
};

export const join = (client: any, runId: string): Promise<Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(`run:${runId}`, { token: 'a.b.c' });
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err: any) => {
        reject(new Error(err));
      });
  });

export const createRun = () => ({
  ...runs['run-1'],
  id: crypto.randomUUID(),
});
