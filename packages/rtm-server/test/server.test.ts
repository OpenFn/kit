import test from 'ava';
import WebSocket, { WebSocketServer } from 'ws';

import createServer, { connectToLightning, startWorkloop } from '../src/server';
import createMockRTM from '../src/mock/runtime-manager';
import { mockChannel, mockSocket, sleep } from './util';
import { CLAIM } from '../src/events';

// Unit tests against the RTM web server
// I don't think there will ever be much here because the server is mostly a pull

let rtm;
let server;
let cancel;

const url = 'http://localhost:7777';

test.beforeEach(() => {
  rtm = createMockRTM();
});

test.afterEach(() => {
  cancel?.(); // cancel any workloops
  server?.close(); // whatever
});

test.skip('healthcheck', async (t) => {
  const server = createServer(rtm, { port: 7777 });
  const result = await fetch(`${url}/healthcheck`);
  t.is(result.status, 200);
  const body = await result.text();
  t.is(body, 'OK');
});

// Not a very thorough test
test('connects to lightning', async (t) => {
  await connectToLightning('www', 'rtm', mockSocket);
  t.pass();

  // TODO connections to hte same socket.channel should share listners, so I think I can test the channel
});

test('workloop can be cancelled', async (t) => {
  let count = 0;
  let cancel;
  const channel = mockChannel({
    [CLAIM]: () => {
      count++;
      cancel();
    },
  });

  cancel = startWorkloop(channel, () => {}, 1);

  await sleep(100);
  // A quirk of how cancel works is that the loop will be called a few times
  t.assert(count <= 5);
});

test('workloop sends the attempts:claim event', (t) => {
  return new Promise((done) => {
    let cancel;
    const channel = mockChannel({
      [CLAIM]: () => {
        t.pass();
        done();
      },
    });
    cancel = startWorkloop(channel, () => {});
  });
});

test('workloop sends the attempts:claim event several times ', (t) => {
  return new Promise((done) => {
    let cancel;
    let count = 0;
    const channel = mockChannel({
      [CLAIM]: () => {
        count++;
        if (count === 5) {
          t.pass();
          done();
        }
      },
    });
    cancel = startWorkloop(channel, () => {});
  });
});

test('workloop calls execute if attempts:claim returns attempts', (t) => {
  return new Promise((done) => {
    let cancel;
    const channel = mockChannel({
      [CLAIM]: () => {
        return [{ id: 'a' }];
      },
    });

    cancel = startWorkloop(channel, (attempt) => {
      t.deepEqual(attempt, { id: 'a' });
      t.pass();
      done();
    });
  });
});

// test('connects to websocket', (t) => {
//   let didSayHello;

//   const wss = new WebSocketServer({
//     port: 8080,
//   });
//   wss.on('message', () => {
//     didSayHello = true;
//   });

//   rtm = createMockRTM();
//   server = createServer(rtm, {
//     port: 7777,
//     lightning: 'ws://localhost:8080',
//     // TODO what if htere's some kind of onready hook?
//     // TODO also we'll need some utility like waitForEvent
//   });

//   t.true(didSayHello);
// });
