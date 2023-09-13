import test from 'ava';

import phx from 'phoenix-channels';
const { Socket } = phx;

import createServer from '../../src/mock/socket-server';

let socket;
let server;

test.beforeEach(() => {
  server = createServer();

  socket = new Socket('ws://localhost:8080');
  socket.connect();
});

test.afterEach(() => {
  server.close();
});

test.serial('respond to connection join requests', async (t) => {
  return new Promise((resolve) => {
    const channel = socket.channel('x', {});

    channel.join().receive('ok', (resp) => {
      t.is(resp, 'ok');

      channel.push('hello');
      resolve();
    });
  });
});

test.serial('send a message', async (t) => {
  return new Promise((resolve) => {
    const channel = socket.channel('x', {});

    server.listenToChannel('x', (event, payload) => {
      t.is(event, 'hello');
      t.deepEqual(payload, { x: 1 });

      resolve();
    });

    channel.join();

    channel.push('hello', { x: 1 });
  });
});
