import test from 'ava';
import axios from 'axios';
import createServer from '../src/server';

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
