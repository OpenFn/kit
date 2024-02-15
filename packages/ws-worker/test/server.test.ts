import test from 'ava';
import createMockRTE from '../src/mock/runtime-engine';
import createWorkerServer from '../src/server';

test.before(async () => {
  const engine = await createMockRTE();
  createWorkerServer(engine as any, {
    port: 2323,
    secret: 'abc',
    maxWorkflows: 1,
  });
});

const baseUrl = 'http://localhost:2323/';

test('return 200 at root', async (t) => {
  const response = await fetch(baseUrl);

  t.is(response.status, 200);
});

test('return healthcheck at /livez', async (t) => {
  const response = await fetch(`${baseUrl}livez`);

  t.is(response.status, 200);
});
