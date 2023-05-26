import test from 'ava';

import createServer from '../src/server';
import createMockRTM from '../src/mock/runtime-manager';

// Unit tests against the RTM web server
// I don't think there will ever be much here because the server is mostly a pull

let server;

const url = 'http://localhost:7777';

test.beforeEach(() => {
  const rtm = createMockRTM();
  server = createServer(rtm, { port: 7777 });
});

test('healthcheck', async (t) => {
  const result = await fetch(`${url}/healthcheck`);
  t.is(result.status, 200);
  const body = await result.text();
  t.is(body, 'OK');
});
