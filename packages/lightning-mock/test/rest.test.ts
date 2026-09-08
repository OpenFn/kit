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

test.serial(
  'should create, update and delete collections across deploys',
  async (t) => {
    const post = (collections: any[]) =>
      fetch(`${endpoint}/api/provision`, {
        method: 'POST',
        body: JSON.stringify({
          id: 'collections-project',
          name: 'collections project',
          collections,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

    // create two collections
    await post([
      { id: 'coll-1', name: 'keep-me' },
      { id: 'coll-2', name: 'remove-me' },
    ]);

    let res = await fetch(`${endpoint}/api/provision/collections-project`);
    let { data: proj } = await res.json();
    t.deepEqual(proj.collections, [
      { id: 'coll-1', name: 'keep-me' },
      { id: 'coll-2', name: 'remove-me' },
    ]);

    // keep one, delete the other, create a third
    await post([
      { id: 'coll-1', name: 'keep-me' },
      { id: 'coll-2', delete: true },
      { id: 'coll-3', name: 'new-collection' },
    ]);

    res = await fetch(`${endpoint}/api/provision/collections-project`);
    ({ data: proj } = await res.json());

    // the deleted collection should be gone entirely, not lingering with
    // a delete flag
    t.deepEqual(proj.collections.map((c: any) => c.id).sort(), [
      'coll-1',
      'coll-3',
    ]);
    t.deepEqual(
      proj.collections.find((c: any) => c.id === 'coll-1'),
      { id: 'coll-1', name: 'keep-me' }
    );
    t.deepEqual(
      proj.collections.find((c: any) => c.id === 'coll-3'),
      { id: 'coll-3', name: 'new-collection' }
    );
  }
);

test.serial('should actually delete a job flagged delete: true', async (t) => {
  const response = await fetch(`${endpoint}/api/provision`, {
    method: 'POST',
    body: JSON.stringify({
      id: DEFAULT_PROJECT_ID,
      name: 'aaa',
      workflows: [
        {
          id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          name: 'wf1',
          jobs: [{ id: '66add020-e6eb-4eec-836b-20008afca816', delete: true }],
        },
      ],
    }),
    headers: { 'content-type': 'application/json' },
  });
  t.is(response.status, 200);

  const res = await fetch(`${endpoint}/api/provision/${DEFAULT_PROJECT_ID}`);
  const { data: proj } = await res.json();
  const wf = proj.workflows.find(
    (w: any) => w.id === '72ca3eb0-042c-47a0-a2a1-a545ed4a8406'
  );
  const jobs = Array.isArray(wf.jobs) ? wf.jobs : Object.values(wf.jobs ?? {});
  t.is(jobs.length, 0);
});

test.serial(
  'should delete a job that is simply omitted, same as delete: true',
  async (t) => {
    const workflowId = '72ca3eb0-042c-47a0-a2a1-a545ed4a8406';

    // seed a job directly, rather than via a setup deploy
    server.addNode(DEFAULT_PROJECT_ID, workflowId, {
      id: 'temp-job',
      name: 'Temp job',
      adaptor: 'common',
      body: 'fn(s => s)',
    });

    const response = await fetch(`${endpoint}/api/provision`, {
      method: 'POST',
      body: JSON.stringify({
        id: DEFAULT_PROJECT_ID,
        name: 'aaa',
        workflows: [{ id: workflowId, name: 'wf1', jobs: [] }],
      }),
      headers: { 'content-type': 'application/json' },
    });
    t.is(response.status, 200);

    const res = await fetch(`${endpoint}/api/provision/${DEFAULT_PROJECT_ID}`);
    const { data: proj } = await res.json();
    const wf = proj.workflows.find((w: any) => w.id === workflowId);
    const jobs = Array.isArray(wf.jobs)
      ? wf.jobs
      : Object.values(wf.jobs ?? {});
    t.is(jobs.length, 0);
  }
);

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
        id: 'wf-1',
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
        id: 'wf-1',
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

test('validateProvisionPayload: returns errors when edge has no source', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        id: 'wf-1',
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
        id: 'wf-1',
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
    workflows: [{ id: 'wf-1', name: 'wf1', edges: [] }],
  };
  t.is(validateProvisionPayload(payload), null);
});

// Unlike a whole workflow, an omitted job/trigger/edge is not an error - for
// these, omission and delete: true mean exactly the same thing.
test('validateProvisionPayload: a job silently vanishing is not an error', (t) => {
  const existingProject = {
    workflows: [
      {
        id: 'wf-1',
        name: 'wf1',
        jobs: [{ id: 'job-1', name: 'Transform data' }],
      },
    ],
  };
  const payload = {
    id: 'proj-1',
    workflows: [{ id: 'wf-1', name: 'wf1', jobs: [] }],
  };

  t.is(validateProvisionPayload(payload, existingProject), null);
});

test('validateProvisionPayload: returns null when a missing job is flagged delete: true', (t) => {
  const existingProject = {
    workflows: [
      {
        id: 'wf-1',
        name: 'wf1',
        jobs: [{ id: 'job-1', name: 'Transform data' }],
      },
    ],
  };
  const payload = {
    id: 'proj-1',
    workflows: [
      { id: 'wf-1', name: 'wf1', jobs: [{ id: 'job-1', delete: true }] },
    ],
  };

  t.is(validateProvisionPayload(payload, existingProject), null);
});

test('validateProvisionPayload: a trigger silently vanishing is not an error', (t) => {
  const existingProject = {
    workflows: [
      {
        id: 'wf-1',
        name: 'wf1',
        triggers: [{ id: 'trig-1', type: 'webhook' }],
      },
    ],
  };
  const payload = {
    id: 'proj-1',
    workflows: [{ id: 'wf-1', name: 'wf1', triggers: [] }],
  };

  t.is(validateProvisionPayload(payload, existingProject), null);
});

test('validateProvisionPayload: an edge silently vanishing is not an error', (t) => {
  const existingProject = {
    workflows: [
      {
        id: 'wf-1',
        name: 'wf1',
        edges: [
          {
            id: 'edge-1',
            source_trigger_id: 'trig-1',
            target_job_id: 'job-1',
          },
        ],
      },
    ],
  };
  const payload = {
    id: 'proj-1',
    workflows: [{ id: 'wf-1', name: 'wf1', edges: [] }],
  };

  t.is(validateProvisionPayload(payload, existingProject), null);
});

test('validateProvisionPayload: errors when a whole workflow silently vanishes without delete: true', (t) => {
  const existingProject = {
    workflows: [{ id: 'wf-1', name: 'wf1' }],
  };
  const payload = { id: 'proj-1', workflows: [] };

  const result = validateProvisionPayload(payload, existingProject);
  t.deepEqual(result, {
    errors: {
      workflows: {
        wf1: {
          delete: ['missing from payload - flag delete: true to remove it'],
        },
      },
    },
  });
});

test('validateProvisionPayload: returns null when a missing workflow is flagged delete: true', (t) => {
  const existingProject = {
    workflows: [{ id: 'wf-1', name: 'wf1' }],
  };
  const payload = {
    id: 'proj-1',
    workflows: [{ id: 'wf-1', delete: true }],
  };

  t.is(validateProvisionPayload(payload, existingProject), null);
});

test('validateProvisionPayload: no existing project means nothing can have vanished', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [{ id: 'wf-1', name: 'wf1', jobs: [], triggers: [], edges: [] }],
  };

  t.is(validateProvisionPayload(payload), null);
});

test('validateProvisionPayload: returns an error when a workflow has no id', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [{ name: 'wf1', edges: [] }],
  };
  const result = validateProvisionPayload(payload);
  t.deepEqual(result, {
    errors: {
      workflows: {
        wf1: {
          id: ["This field can't be blank"],
        },
      },
    },
  });
});

test('validateProvisionPayload: returns an error when an edge has no id', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        id: 'wf-1',
        name: 'wf1',
        edges: [
          {
            source_trigger_id: 'trig-uuid',
            target_job_id: 'job-uuid',
            enabled: true,
          },
        ],
      },
    ],
  };
  const result = validateProvisionPayload(payload);
  t.deepEqual(result, {
    errors: {
      workflows: {
        wf1: {
          edges: {
            '->': {
              id: ["This field can't be blank"],
            },
          },
        },
      },
    },
  });
});

test('validateProvisionPayload: returns an error when a job has no id', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        id: 'wf-1',
        name: 'wf1',
        edges: [],
        jobs: [{ name: 'Transform data' }],
      },
    ],
  };
  const result = validateProvisionPayload(payload);
  t.deepEqual(result, {
    errors: {
      workflows: {
        wf1: {
          jobs: {
            'Transform data': {
              id: ["This field can't be blank"],
            },
          },
        },
      },
    },
  });
});

test('validateProvisionPayload: returns an error when a trigger has no id', (t) => {
  const payload = {
    id: 'proj-1',
    workflows: [
      {
        id: 'wf-1',
        name: 'wf1',
        edges: [],
        triggers: [{ type: 'webhook', enabled: true }],
      },
    ],
  };
  const result = validateProvisionPayload(payload);
  t.deepEqual(result, {
    errors: {
      workflows: {
        wf1: {
          triggers: {
            webhook: {
              id: ["This field can't be blank"],
            },
          },
        },
      },
    },
  });
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
