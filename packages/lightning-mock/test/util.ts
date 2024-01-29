import { Socket } from 'phoenix';
import { WebSocket } from 'ws';
import crypto from 'node:crypto';

import createLightningServer from '../src/server';
import type { DevServer } from '../src/types';
import { attempts } from './data';

type Channel = any; // TODO

export const setup = (port: number) => {
  return new Promise<{ server: DevServer; client: any }>((done) => {
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

export const join = (client: any, attemptId: string): Promise<Channel> =>
  new Promise((done, reject) => {
    const channel = client.channel(`run:${attemptId}`, { token: 'a.b.c' });
    channel
      .join()
      .receive('ok', () => {
        done(channel);
      })
      .receive('error', (err) => {
        reject(new Error(err));
      });
  });

export const createAttempt = () => ({
  ...attempts['attempt-1'],
  id: crypto.randomUUID(),
});
