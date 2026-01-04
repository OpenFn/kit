// Tests of the REST API
import test from 'ava';

import { setup } from './util';
import { DEFAULT_PROJECT_ID } from '../src/api-rest';

// @ts-ignore
let server: any;

const port = 3334;

const endpoint = `http://localhost:${port}`;

test.before(async () => ({ server } = await setup(port)));

test.serial('should pull a project', async (t) => {
  const response = await fetch(
    `${endpoint}/api/provision/${DEFAULT_PROJECT_ID}`
  );
  const { data: proj } = await response.json();

  t.is(proj.id, DEFAULT_PROJECT_ID);
  t.is(proj.name, 'aaa');
  t.truthy(proj.workflows);
});

test.serial('should pull a project as yaml', async (t) => {
  const response = await fetch(`${endpoint}/api/provision/yaml?id=123`);
  const proj = await response.text();

  t.regex(proj, /name: aaa/);
  t.regex(proj, /name: wf1/);
});

test.serial('should deploy a project and fetch it back', async (t) => {
  const response = await fetch(`${endpoint}/api/provision`, {
    method: 'POST',
    body: JSON.stringify({
      id: 'abc',
      name: 'my project',
    }),
    headers: {
      'content-type': 'application/json',
    },
  });

  t.is(response.status, 200);

  const res2 = await fetch(`${endpoint}/api/provision/abc`);
  const { data: proj } = await res2.json();
  t.is(proj.id, 'abc');
  t.is(proj.name, 'my project');
});

test.serial('should fetch many items from a collection', async (t) => {
  server.collections.createCollection('stuff');
  server.collections.upsert('stuff', 'x', { id: 'x' });

  const response = await fetch(`${endpoint}/collections/stuff/*`);
  const { items } = await response.json();
  t.is(items.length, 1);
  t.deepEqual(items[0], { key: 'x', value: { id: 'x' } });
});

test.serial('should fetch a single item from a collection', async (t) => {
  server.collections.createCollection('stuff');
  server.collections.upsert('stuff', 'x', { id: 'x' });

  const response = await fetch(`${endpoint}/collections/stuff/x`);
  const { items } = await response.json();
  t.is(items.length, 1);
  t.deepEqual(items[0], { key: 'x', value: { id: 'x' } });
});

test.serial("should return 404 if a collection isn't found", async (t) => {
  const response = await fetch(`${endpoint}/collections/nope/*`);
  t.is(response.status, 404);
});

test.todo("should return 403 if a collection isn't authorized");
