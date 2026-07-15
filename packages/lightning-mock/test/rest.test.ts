// Tests of the REST API
import test from 'ava';

import { setup } from './util';
import { DEFAULT_PROJECT_ID, validateProvisionPayload } from '../src/api-rest';

// @ts-ignore
let server: any;

const port = 3334;

const endpoint = `http://localhost:${port}`;

test.before(async () => ({ server } = await setup(port)));

test.serial('should pull a project', async (t) => {
  const response = await fetch(
    `${endpoint}/api/provision/${DEFAULT_PROJECT_ID}`
  );
  t.is(response.status, 200);

  const { data: proj } = await response.json();

  t.is(proj.id, DEFAULT_PROJECT_ID);
  t.is(proj.name, 'aaa');
  t.truthy(proj.workflows);
});

test.serial("should return 404 if a project isn't found", async (t) => {
  const response = await fetch(`${endpoint}/api/provision/nah`);
  t.is(response.status, 404);
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

  const response = await fetch(`${endpoint}/collections/stuff?query=*`);
  const { items } = await response.json();
  t.is(items.length, 1);
  t.deepEqual(items[0], { key: 'x', value: { id: 'x' } });
});

test.serial('should fetch a single item from a collection', async (t) => {
  server.collections.createCollection('stuff');
  server.collections.upsert('stuff', 'x', { id: 'x' });

  const response = await fetch(`${endpoint}/collections/stuff/x`);
  const result = await response.json();
  t.deepEqual(result, { key: 'x', value: { id: 'x' } });
});

test.serial("should return 404 if a collection isn't found", async (t) => {
  const response = await fetch(`${endpoint}/collections/nope/*`);
  t.is(response.status, 404);
});

test.todo("should return 403 if a collection isn't authorized");

test('validateProvisionPayload: returns null for a valid edge with source_trigger_id', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        name: 'wf1',
        edges: [
          {
            id: 'e1',
            source_trigger_id: 'trig-uuid',
            target_job_id: 'job-uuid',
            enabled: true,
          },
        ],
      },
    ],
  };
  t.is(validateProvisionPayload(payload), null);
});

test('validateProvisionPayload: returns null for a valid edge with source_job_id', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        name: 'wf1',
        edges: [
          {
            id: 'e1',
            source_job_id: 'job-uuid',
            target_job_id: 'job-uuid-2',
            enabled: true,
          },
        ],
      },
    ],
  };
  t.is(validateProvisionPayload(payload), null);
});

test('validateProvisionPayload: returns errors when edge has no source job or trigger id', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        name: 'wf1',
        edges: [
          {
            id: 'edge-1',
            source_trigger_id: null,
            target_job_id: '',
            enabled: true,
          },
        ],
      },
    ],
  };
  const result = validateProvisionPayload(payload);
  t.truthy(result);
  t.deepEqual(result, {
    errors: {
      workflows: {
        wf1: {
          edges: {
            'edge-1': {
              source_job_id: [
                'source_job_id or source_trigger_id must be present',
              ],
            },
          },
        },
      },
    },
  });
});

test('validateProvisionPayload: for new edges allow source_job', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        name: 'wf1',
        edges: [
          {
            id: 'edge-1',
            source_trigger_id: null,
            target_job_id: '',
            enabled: true,
          },
        ],
      },
    ],
  };
  const result = validateProvisionPayload(payload);
  t.truthy(result);
  t.deepEqual(result, {
    errors: {
      workflows: {
        wf1: {
          edges: {
            'edge-1': {
              source_job_id: [
                'source_job_id or source_trigger_id must be present',
              ],
            },
          },
        },
      },
    },
  });
});

test('validateProvisionPayload: returns null for deleted edges', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        name: 'wf1',
        edges: [
          {
            id: 'edge-1',
            delete: true,
          },
        ],
      },
    ],
  };
  const result = validateProvisionPayload(payload);
  t.falsy(result);
});

test('validateProvisionPayload: returns null when there are no edges', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [{ name: 'wf1', edges: [] }],
  };
  t.is(validateProvisionPayload(payload), null);
});

test.serial(
  'should return 422 when a workflow edge has no source',
  async (t) => {
    const response = await fetch(`${endpoint}/api/provision`, {
      method: 'POST',
      body: JSON.stringify({
        id: 'bad-proj',
        name: 'Bad Project',
        workflows: [
          {
            id: 'wf-uuid',
            name: 'wf1',
            jobs: [],
            triggers: [],
            edges: [
              {
                id: 'e1',
                source_trigger_id: null,
                target_job_id: '',
                enabled: true,
              },
            ],
          },
        ],
      }),
      headers: { 'content-type': 'application/json' },
    });

    t.is(response.status, 422);
    const body = await response.json();
    t.truthy(body.errors?.workflows?.wf1?.edges);
  }
);
