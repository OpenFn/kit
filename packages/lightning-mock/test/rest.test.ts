// Tests of the REST API
import test from 'ava';

import { setup } from './util';

let server: any;
let client: any;

const port = 3334;

const endpoint = `http://localhost:${port}`;

test.before(async () => ({ server, client } = await setup(port)));

test.serial('should pull a project', async (t) => {
  const response = await fetch(`${endpoint}/api/provision/123`);
  const { data: proj } = await response.json();

  t.is(proj.id, '123');
  t.is(proj.name, 'aaa');
  t.truthy(proj.workflows);
});

test.serial('should pull a project as yaml', async (t) => {
  const response = await fetch(`${endpoint}/api/provision/yaml?id=123`);
  const proj = await response.text();

  t.regex(proj, /name: aaa/);
  t.regex(proj, /name: wf1/);
});

test.serial('should deploy a project', async (t) => {
  const response = await fetch(`${endpoint}/api/provision`, {
    method: 'POST',
    body: JSON.stringify({}), // Not a very good test right now!!
    headers: {
      'content-type': 'application/json',
    },
  });

  t.is(response.status, 200);
});
