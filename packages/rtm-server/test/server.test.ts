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
