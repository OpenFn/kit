import test from 'ava';
import axios from 'axios';
import createServer from '../src/server';

// Unit tests against the RTM web server
// I don't think there will ever be much here because the server is mostly a pull

let server;

const url = 'http://localhost:7777';

test.beforeEach(() => {
  server = createServer({ port: 7777 });
});

test('healthcheck', async (t) => {
  const result = await axios.get(`${url}/healthcheck`);
  t.is(result.status, 200);
  t.is(result.data, 'OK');
});
