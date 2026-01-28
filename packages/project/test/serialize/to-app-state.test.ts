import test from 'ava';
import { Project } from '../../src/Project';
import toAppState from '../../src/serialize/to-app-state';
import { generateProject } from '../../src/gen/generator';

import type { Provisioner } from '@openfn/lexicon/lightning';

const state: Provisioner.Project = {
  id: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
  name: 'aaa',
  description: 'a project',
  concurrency: null,
  inserted_at: '2025-04-23T11:15:59Z',
  collections: [],
  workflows: {
    wf1: {
      id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      name: 'wf1',
      edges: {
        'trigger->transform-data': {
          enabled: true,
          id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
          source_trigger_id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          condition_type: 'always',
          target_job_id: '66add020-e6eb-4eec-836b-20008afca816',
        },
      },
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      jobs: {
        'transform-data': {
          id: '66add020-e6eb-4eec-836b-20008afca816',
          name: 'Transform data',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: '<uuid:c1>',
          keychain_credential_id: null,
        },
      },
      triggers: {
        webhook: {
          enabled: true, // TODO enabled: false is a bit interesting
          id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          type: 'webhook',
        },
      },
      lock_version: 1,
      deleted_at: null,
    },
  },
  updated_at: '2025-04-23T11:15:59Z',
  project_credentials: ['<uuid:c1>'],
  scheduled_deletion: null,
  allow_support_access: false,
  requires_mfa: false,
  retention_policy: 'retain_all',
  history_retention_period: null,
  dataclip_retention_period: null,
};

test('should set defaults for keys that Lightning needs', (t) => {
  // set up a very minimal project
  const data: any = {
    id: 'my-project',
    openfn: {
      uuid: '<uuid>',
    },
    workflows: [
      {
        id: 'wf',
        name: 'my workflow',
        openfn: {
          uuid: 0,
        },
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            next: {
              step: {
                openfn: {
                  uuid: '<trigger-step>',
                },
              },
            },
            openfn: {
              uuid: 1,
            },
          },
          {
            id: 'step',
            expression: '.',
            openfn: {
              uuid: 2,
            },
          },
        ],
      },
    ],
  };
  const project = new Project(data, {
    formats: {
      project: 'json',
    },
  });

  const defaultState = toAppState(project);
  t.deepEqual(defaultState, {
    id: '<uuid>',
    project_credentials: [],
    workflows: {
      'my-workflow': {
        id: 0,
        name: 'my workflow',
        jobs: {
          step: {
            body: '.',
            id: 2,
            project_credential_id: null,
            keychain_credential_id: null,
          },
        },
        triggers: { webhook: { type: 'webhook', id: 1 } },
        edges: {
          ['trigger->step']: {
            id: '<trigger-step>',
            target_job_id: 2,
            enabled: true,
            source_trigger_id: 1,
          },
        },
        lock_version: null,
      },
    },
  });
});

test('should serialize workflow positions', (t) => {
  const data = {
    id: 'my-project',
    workflows: [
      {
        id: 'wf',
        name: 'wf',
        openfn: {
          positions: {
            step: {
              x: 1,
              y: 1,
            },
          },
        },
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            next: {
              step: {},
            },
          },
          {
            id: 'step',
            expression: '.',
          },
        ],
      },
    ],
  };
  const project = new Project(data, {
    formats: {
      project: 'json',
    },
  });

  const state = toAppState(project);
  t.deepEqual(state.workflows['wf'].positions, {
    step: {
      x: 1,
      y: 1,
    },
  });
});

// This test just ensures that whatever we write to an openfn object
// gets written back to state
test('should write openfn keys to objects', (t) => {
  const openfn = { x: 1 };
  const data = {
    id: 'my-project',
    openfn,
    workflows: [
      {
        id: 'wf',
        name: 'wf',
        openfn,
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            next: {
              step: {
                openfn,
              },
            },
            openfn,
          },
          {
            id: 'step',
            expression: '.',
            openfn,
          },
        ],
      },
    ],
  };
  const project = new Project(data, {
    formats: {
      project: 'json',
    },
  });

  const state = toAppState(project);
  t.is(state.x, 1);
  t.is(state.workflows['wf'].x, 1);
  t.is(state.workflows['wf'].jobs.step.x, 1);
  t.is(state.workflows['wf'].triggers.webhook.x, 1);
  t.is(state.workflows['wf'].edges['trigger->step'].x, 1);
});

test('should handle credentials', (t) => {
  const data = {
    id: 'my-project',
    workflows: [
      {
        id: 'wf',
        name: 'wf',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            next: {
              step: {},
            },
          },
          {
            id: 'step',
            expression: '.',
            configuration: 'p',
            openfn: {
              keychain_credential_id: 'k',
            },
          },
        ],
      },
    ],
  };

  const state = toAppState(new Project(data), { format: 'json' });
  const { step } = state.workflows['wf'].jobs;
  t.is(step.keychain_credential_id, 'k');
  t.is(step.project_credential_id, 'p');
});

test('should ignore forked_from', (t) => {
  const data = {
    id: 'my-project',
    workflows: [
      {
        id: 'wf',
        name: 'wf',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            next: {
              step: {},
            },
          },
          {
            id: 'step',
            expression: '.',
            configuration: 'p',
            openfn: {
              keychain_credential_id: 'k',
            },
          },
        ],
      },
    ],
    cli: {
      forked_form: { wf: 'a' },
    },
  };
  const proj = new Project(data);
  console.log(proj);
  const state = toAppState(proj, { format: 'json' });
  console.log(state);
  t.falsy((state as any).forked_form);
});

test('should ignore workflow start keys', (t) => {
  const data = {
    id: 'my-project',
    workflows: [
      {
        id: 'wf',
        name: 'wf',
        start: 'step',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            next: {
              step: {},
            },
          },
          {
            id: 'step',
            expression: '.',
            configuration: 'p',
            openfn: {
              keychain_credential_id: 'k',
            },
          },
        ],
      },
    ],
  };

  const state = toAppState(new Project(data), { format: 'json' });
  t.falsy(state.workflows['wf'].start);
});

test('should handle edge labels', (t) => {
  const data = {
    id: 'my-project',
    workflows: [
      {
        id: 'wf',
        name: 'wf',
        start: 'step',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            next: {
              step: {
                label: 'hello',
              },
            },
          },
          {
            id: 'step',
            expression: '.',
            configuration: 'p',
            openfn: {
              keychain_credential_id: 'k',
            },
          },
        ],
      },
    ],
  };

  const state = toAppState(new Project(data), { format: 'json' });
  t.is(state.workflows.wf.edges['trigger->step'].condition_label, 'hello');
});

test('serialize steps and trigger in alphabetical order', (t) => {
  const wf = `@name wf
z-b
y-x
c-p
  `;
  const project = generateProject('proj', [wf], { uuidSeed: 1 });

  const state = toAppState(project, { format: 'json' });

  const jobs = Object.keys(state.workflows['wf'].jobs);
  // short be sorted by name
  t.deepEqual(jobs, ['b', 'c', 'p', 'x', 'y', 'z']);

  const edges = Object.keys(state.workflows['wf'].edges);
  // edges are sorted by uuid
  t.deepEqual(edges, ['z->b', 'y->x', 'c->p']);
});

test('should handle edge conditions', (t) => {
  const wf = `@name wf
a-(condition=always)-b
a-(condition="on_job_success")-c
a-(condition="on_job_failure")-d
a-(condition=never)-e
a-(condition=x)-f
  `;
  const project = generateProject('p', [wf], {
    uuidSeed: 1, // ensure predictable UUIDS
  });

  const state = toAppState(project, { format: 'json' });
  const {
    'a->b': a_b,
    'a->c': a_c,
    'a->d': a_d,
    'a->e': a_e,
    'a->f': a_f,
  } = state.workflows.wf.edges;

  t.is(a_b.condition_type, 'always');
  t.falsy(a_b.condition_expression);

  t.is(a_c.condition_type, 'on_job_success');
  t.falsy(a_c.condition_expression);

  t.is(a_d.condition_type, 'on_job_failure');
  t.falsy(a_d.condition_expression);

  t.is(a_e.condition_type, 'never');
  t.falsy(a_e.condition_expression);

  t.is(a_f.condition_type, 'js_expression');
  t.is(a_f.condition_expression, 'x');
});

test('should convert a project back to app state in json', (t) => {
  // this is a serialized project file
  const data = {
    name: 'aaa',
    description: 'a project',
    // TODO I think we might need more automation of this?
    credentials: ['<uuid:c1>'],
    collections: [],
    openfn: {
      env: 'project',
      uuid: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
      endpoint: 'http://localhost:4000',
      inserted_at: '2025-04-23T11:15:59Z',
      updated_at: '2025-04-23T11:15:59Z',
    },
    // TODO didn't we move fetched_at to openfn?
    meta: {
      fetched_at: 'abc',
    },
    // TODO need to ensure this is created on the other end
    options: {
      scheduled_deletion: null,
      allow_support_access: false,
      requires_mfa: false,
      retention_policy: 'retain_all',
      history_retention_period: null,
      dataclip_retention_period: null,
      concurrency: null,
    },
    workflows: [
      {
        name: 'wf1',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            openfn: {
              enabled: true,
              uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
            },
            next: {
              'transform-data': {
                disabled: false,
                condition: true,
                openfn: {
                  uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
                },
              },
            },
          },
          {
            id: 'transform-data',
            name: 'Transform data',
            expression: 'fn(s => s)',
            adaptor: '@openfn/language-common@latest',
            configuration: '<uuid:c1>',
            openfn: {
              uuid: '66add020-e6eb-4eec-836b-20008afca816',
            },
          },
        ],
        openfn: {
          uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          inserted_at: '2025-04-23T11:19:32Z',
          updated_at: '2025-04-23T11:19:32Z',
          lock_version: 1,
          deleted_at: null,
          concurrency: null,
        },
      },
    ],
  };
  const project = new Project(data, {
    formats: {
      project: 'json',
    },
  });

  const newState = toAppState(project);
  // t.log(JSON.stringify(newState, null, 2));
  t.deepEqual(newState, state);
});

// TODO this test is failing because the order of keys in the yaml have changed!
// We probably need to force alphabetical sorting on yaml keys
test.skip('should convert a project back to app state in yaml', (t) => {
  // this is a serialized project file
  const data = {
    name: 'aaa',
    description: 'a project',
    credentials: [],
    collections: [],
    openfn: {
      env: 'project',
      uuid: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
      endpoint: 'http://localhost:4000',
      inserted_at: '2025-04-23T11:15:59Z',
      updated_at: '2025-04-23T11:15:59Z',
    },
    meta: {
      fetched_at: 'abc',
    },
    // TODO need to ensure this is created on the other end
    options: {
      scheduled_deletion: null,
      allow_support_access: false,
      requires_mfa: false,
      retention_policy: 'retain_all',
      history_retention_period: null,
      dataclip_retention_period: null,
      concurrency: null,
    },
    workflows: [
      {
        name: 'wf1',
        steps: [
          {
            id: 'trigger',
            type: 'webhook',
            openfn: {
              enabled: true,
              uuid: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
            },
            next: {
              'transform-data': {
                disabled: false,
                condition: true,
                openfn: {
                  uuid: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
                },
              },
            },
          },
          {
            id: 'transform-data',
            name: 'Transform data',
            expression: 'fn(s => s)',
            adaptor: '@openfn/language-common@latest',
            openfn: {
              uuid: '66add020-e6eb-4eec-836b-20008afca816',
              project_credential_id: null,
            },
          },
        ],
        openfn: {
          uuid: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
          inserted_at: '2025-04-23T11:19:32Z',
          updated_at: '2025-04-23T11:19:32Z',
          lock_version: 1,
          deleted_at: null,
          concurrency: null,
        },
      },
    ],
  };
  const project = new Project(data, {
    formats: {
      project: 'yaml',
    },
  });

  const yaml = toAppState(project);
  t.deepEqual(
    yaml,
    `id: e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00
name: aaa
description: a project
project_credentials: []
collections: []
inserted_at: 2025-04-23T11:15:59Z
updated_at: 2025-04-23T11:15:59Z
scheduled_deletion: null
allow_support_access: false
requires_mfa: false
retention_policy: retain_all
history_retention_period: null
dataclip_retention_period: null
concurrency: null
workflows:
  - name: wf1
    id: 72ca3eb0-042c-47a0-a2a1-a545ed4a8406
    inserted_at: 2025-04-23T11:19:32Z
    updated_at: 2025-04-23T11:19:32Z
    lock_version: 1
    deleted_at: null
    concurrency: null
    jobs:
      - name: Transform data
        body: |
          // Check out the Job Writing Guide for help getting started:
          // https://docs.openfn.org/documentation/jobs/job-writing-guide
        adaptor: "@openfn/language-common@latest"
        id: 66add020-e6eb-4eec-836b-20008afca816
        project_credential_id: null
    triggers:
      - type: webhook
        enabled: true
        id: 4a06289c-15aa-4662-8dc6-f0aaacd8a058
    edges:
      - id: a9a3adef-b394-4405-814d-3ac4323f4b4b
        target_job_id: 66add020-e6eb-4eec-836b-20008afca816
        enabled: true
        source_trigger_id: 4a06289c-15aa-4662-8dc6-f0aaacd8a058
        condition_type: always
`
  );
});
