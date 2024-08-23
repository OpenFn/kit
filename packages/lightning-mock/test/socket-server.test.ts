import test from 'ava';
import EventEmitter from 'node:events';
import { Socket } from 'phoenix';
import { WebSocket } from 'ws';
import createSocketServer from '../src/socket-server';

let socket: any;
let server: any;
let messages: any;

const wait = (duration = 10) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

test.beforeEach(
  () =>
    new Promise((done) => {
      messages = [];
      // @ts-ignore I don't care about missing server options here
      server = createSocketServer({
        // @ts-ignore
        state: {
          events: new EventEmitter(),
        },
        onMessage: (evt) => {
          messages.push(evt);
        },
      });

      socket = new Socket('ws://localhost:8080', {
        transport: WebSocket,
        params: { token: 'x.y.z' },
      });

      socket.onOpen(done);

      socket.connect();
    })
);

test.afterEach(() => {
  server.close();
});

test.serial('respond to connection join requests', async (t) => {
  return new Promise((resolve) => {
    const channel = socket.channel('x', {});

    channel
      .join()
      .receive('ok', (resp: any) => {
        t.is(resp, 'ok');

        channel.push('hello');
        resolve();
      })
      .receive('error', (e: any) => {
        console.log(e);
      });
  });
});

test.serial('send a message', async (t) => {
  return new Promise((resolve) => {
    const channel = socket.channel('x', {});

    server.listenToChannel('x', (_ws: any, { payload, event }: any) => {
      t.is(event, 'hello');
      t.deepEqual(payload, { x: 1 });

      resolve();
    });

    channel.join();

    channel.push('hello', { x: 1 });
  });
});

test.serial('send a message only to one channel', async (t) => {
  let didCallX = false;
  let didCallY = false;

  const x = socket.channel('x', {});
  x.join();

  const y = socket.channel('y', {});
  y.join();

  server.listenToChannel('x', () => {
    didCallX = true;
  });
  server.listenToChannel('y', () => {
    didCallY = true;
  });

  x.push('hello', { x: 1 });

  await wait();

  t.true(didCallX);
  t.false(didCallY);
});

test.serial('unsubscribe', (t) => {
  return new Promise(async (resolve) => {
    let count = 0;

    const channel = socket.channel('x', {});
    channel.join();

    const listener = server.listenToChannel('x', () => {
      count++;
    });

    channel.push('hello', { x: 1 });
    await wait(100);

    t.is(count, 1);

    listener.unsubscribe();

    channel.push('hello', { x: 1 });
    await wait();

    t.is(count, 1);

    resolve();
  });
});

test.serial('wait for message', async (t) => {
  const channel = socket.channel('x', {});
  channel.join();

  channel.push('hello', { x: 1 });

  const result = await server.waitForMessage('x', 'hello');
  t.truthy(result);
});

test.serial('onMessage', (t) => {
  return new Promise((done) => {
    const channel = socket.channel('x', {});
    channel.join().receive('ok', async () => {
      t.is(messages.length, 1);
      t.is(messages[0].event, 'phx_join');

      channel.push('hello', { x: 1 });
      await server.waitForMessage('x', 'hello');
      t.is(messages.length, 2);
      t.is(messages[1].event, 'hello');
      done();
    });
  });
});

test.serial('defer message', (t) => {
  return new Promise(async (done) => {
    // Bit annoying but  we need to rebuild the server to
    // get a delay on it
    server.close();

    server = createSocketServer({
      // @ts-ignore
      state: {
        events: new EventEmitter(),
      },
      onMessage: (evt) => {
        messages.push(evt);
      },
      socketDelay: 500,
    });

    socket = new Socket('ws://localhost:8080', {
      transport: WebSocket,
      params: { token: 'x.y.z' },
    });

    socket.connect();

    await wait(500);

    const channel = socket.channel('x', {});
    const start = Date.now();
    channel.join().receive('ok', async () => {
      const duration = Date.now() - start;
      t.assert(duration >= 500);
      done();
    });
  });
});
