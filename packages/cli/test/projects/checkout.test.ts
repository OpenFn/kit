import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import { handler as checkoutHandler } from '../../src/projects/checkout';
import mock from 'mock-fs';
import fs from 'fs';
import { jsonToYaml, Workspace, yamlToJson } from '@openfn/project';

test.beforeEach(() => {
  mock({
    '/ws/workflows': {},
    '/ws/openfn.yaml': jsonToYaml({
      project: {
        id: 'my-project',
      },
      workspace: {
        workflowRoot: 'workflows',
        formats: {
          openfn: 'yaml',
          project: 'yaml',
          workflow: 'yaml',
        },
      },
    }),
    '/ws/.projects/staging@app.openfn.org.yaml': jsonToYaml({
      id: '<uuid:staging>',
      name: 'My Staging',
      workflows: [
        {
          name: 'simple-workflow',
          id: 'wf-id',
          history: ['a'],
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: ' fn(state => state); // sdfl',
              adaptor: '@openfn/language-http@latest',
              id: 'job-a',
            },
          ],
          triggers: [
            {
              type: 'webhook',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-id',
              target_job_id: 'job-a',
              enabled: true,
              source_trigger_id: 'trigger-id',
              condition_type: 'always',
            },
          ],
        },
        {
          name: 'another-workflow',
          id: 'another-id',
          history: ['b'],
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: ' fn(state => state); // sdfl',
              adaptor: '@openfn/language-http@latest',
              id: 'job-b',
            },
          ],
          triggers: [
            {
              type: 'webhook',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-id',
              target_job_id: 'job-b',
              enabled: true,
              source_trigger_id: 'trigger-id',
              condition_type: 'always',
            },
          ],
        },
      ],
    }),
    // TODO this is actually a v1 state file for some reason, which is wierd
    '/ws/.projects/project@app.openfn.org.yaml': jsonToYaml({
      id: '<uuid:main>',
      name: 'My Project',
      workflows: [
        {
          name: 'simple-workflow-main',
          id: 'wf-id-main',
          version_history: ['a'],
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: ' fn(state => state); // sdfl',
              adaptor: '@openfn/language-http@latest',
              id: 'job-a',
            },
          ],
          triggers: [
            {
              type: 'webhook',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-id',
              target_job_id: 'job-a',
              enabled: true,
              source_trigger_id: 'trigger-id',
              condition_type: 'always',
            },
          ],
        },
        {
          name: 'another-workflow-main',
          id: 'another-id',
          version_history: ['b'],
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: ' fn(state => state); // sdfl',
              adaptor: '@openfn/language-http@latest',
              id: 'job-b',
            },
          ],
          triggers: [
            {
              type: 'webhook',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-id',
              target_job_id: 'job-b',
              enabled: true,
              source_trigger_id: 'trigger-id',
              condition_type: 'always',
            },
          ],
        },
      ],
    }),
  });
});

const logger = createMockLogger('', { level: 'debug' });

test.serial('checkout: invalid project id', async (t) => {
  await t.throwsAsync(
    () =>
      checkoutHandler(
        {
          command: 'project-checkout',
          project: 'not-known',
          workspace: '/ws',
        },
        logger
      ),
    {
      message: 'Project with id not-known not found in the workspace',
    }
  );
});

test.serial('checkout: to a different valid project', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject!.id, 'my-project');

  await checkoutHandler(
    { command: 'project-checkout', project: 'my-project', workspace: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject!.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: same id as active', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'my-project',
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject!.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: makes git ignore the checkout state', async (t) => {
  await checkoutHandler(
    { command: 'project-checkout', project: 'my-project', workspace: '/ws' },
    logger
  );

  t.is(fs.readFileSync('/ws/.openfn/.gitignore', 'utf8'), '*\n');
});

test.serial(
  'checkout: writes forked_from based on version history',
  async (t) => {
    const bcheckout = new Workspace('/ws');
    t.is(bcheckout.activeProject!.id, 'my-project');

    await checkoutHandler(
      { command: 'project-checkout', project: 'my-project', workspace: '/ws' },
      logger
    );

    const checkout = yamlToJson(
      fs.readFileSync('/ws/.openfn/checkout.yaml', 'utf8')
    );
    t.deepEqual(checkout.forked_from, {
      'simple-workflow-main': 'a',
      'another-workflow-main': 'b',
    });
  }
);

test.serial(
  'checkout: preserves a renamed (aliased) workflow folder',
  async (t) => {
    await checkoutHandler(
      { command: 'project-checkout', project: 'my-project', workspace: '/ws' },
      logger
    );
    fs.renameSync('/ws/workflows/simple-workflow-main', '/ws/workflows/wf');

    await checkoutHandler(
      { command: 'project-checkout', project: 'my-project', workspace: '/ws' },
      logger
    );

    t.deepEqual(
      fs.readdirSync('/ws/workflows').sort(),
      ['another-workflow-main', 'wf'].sort()
    );
    t.true(fs.existsSync('/ws/workflows/wf/simple-workflow-main.yaml'));
  }
);

test.serial(
  'checkout: drops an alias that clashes with an incoming workflow id',
  async (t) => {
    await checkoutHandler(
      { command: 'project-checkout', project: 'my-project', workspace: '/ws' },
      logger
    );
    fs.renameSync('/ws/workflows/simple-workflow-main', '/ws/workflows/wf');

    // a workflow called "wf" gets added remotely
    const statePath = '/ws/.projects/project@app.openfn.org.yaml';
    const state = yamlToJson(fs.readFileSync(statePath, 'utf8'));
    state.workflows.push({ ...state.workflows[1], name: 'wf', id: 'wf-id' });
    fs.writeFileSync(statePath, jsonToYaml(state));

    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'my-project',
        workspace: '/ws',
        force: true,
      },
      logger
    );

    t.deepEqual(
      fs.readdirSync('/ws/workflows').sort(),
      ['another-workflow-main', 'simple-workflow-main', 'wf'].sort()
    );
    t.deepEqual(fs.readdirSync('/ws/workflows/wf').sort(), [
      'transform-data-to-fhir-standard.js',
      'wf.yaml',
    ]);
  }
);

test.serial('checkout: switching to and back between projects', async (t) => {
  // before checkout. my-project is active and expanded
  const bcheckout = new Workspace('/ws');
  t.is(bcheckout.activeProject!.id, 'my-project');

  // 1. switch from my-project to my-staging
  await checkoutHandler(
    { command: 'project-checkout', project: 'my-staging', workspace: '/ws' },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout. my-staging is active and expanded
  const acheckout = new Workspace('/ws');
  t.is(acheckout.activeProject!.id, 'my-staging');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow', 'another-workflow'].sort()
  );

  // 2. switch back from my-project to my-project
  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'my-project',
      workspace: '/ws',
      clean: true,
    },
    logger
  );
  const { message: lastMsg } = logger._parse(logger._last);
  t.is(lastMsg, 'Expanded project to /ws');

  // after checkout. my-project is active and expanded
  const fcheckout = new Workspace('/ws');
  t.is(fcheckout.activeProject!.id, 'my-project');

  // check if files where well expanded
  t.deepEqual(
    fs.readdirSync('/ws/workflows').sort(),
    ['simple-workflow-main', 'another-workflow-main'].sort()
  );
});

test.serial('checkout: switch with id', async (t) => {
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'my-staging',
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  const after = new Workspace('/ws');
  t.is(after.activeProject!.id, 'my-staging');
});

test.serial('checkout: switch with alias', async (t) => {
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'staging', // this is actually an alias
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  const after = new Workspace('/ws');
  t.is(after.activeProject!.id, 'my-staging');
});

// TODO this doesn't work locally because the serialized files in are in v1,
// and have no domain information attached
// This fuzzy match is better covered in the projects testing though
test.serial.skip('checkout: switch with alias and domain', async (t) => {
  const before = new Workspace('/ws');
  t.is(before.activeProject!.id, 'my-project');

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'staging@app.openfn.org', // this is actually an alias
      workspace: '/ws',
    },
    logger
  );
  const { message } = logger._parse(logger._last);
  t.is(message, 'Expanded project to /ws');

  // after checkout: staging is active and expanded
  const after = new Workspace('/ws');
  t.is(after.activeProject!.id, 'my-staging');
});

test.serial('respect openfn.yaml settings', async (t) => {
  mock({
    '/ws1/w': {},
    '/ws1/openfn.yaml': jsonToYaml({
      project: {
        id: 'main',
      },
      workspace: {
        dirs: {
          workflows: 'w',
          projects: 'p',
        },
        formats: {
          openfn: 'yaml', // TODO need to test that this can be JSON too
          project: 'json',
          workflow: 'json',
        },
      },
    }),
    '/ws1/p/staging@app.openfn.org.json': JSON.stringify({
      id: '<uuid:staging>',
      name: 'Staging',
      workflows: [
        {
          name: 'Simple Workflow',
          id: 'wf1',
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: '.',
              adaptor: '@openfn/language-http@latest',
              id: 'job-a',
            },
          ],
          triggers: [
            {
              type: 'webhook',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-id',
              target_job_id: 'job-a',
              enabled: true,
              source_trigger_id: 'trigger-id',
              condition_type: 'always',
            },
          ],
        },
      ],
    }),
    '/ws1/p/project@app.openfn.org.json': JSON.stringify({
      id: '<uuid:main>',
      name: 'Main',
      workflows: [
        {
          name: 'simple-workflow-main',
          id: 'wf-id-main',
          jobs: [
            {
              name: 'Transform data to FHIR standard',
              body: 'fn(s => s)',
              adaptor: '@openfn/language-http@latest',
              id: 'job-a',
            },
          ],
          triggers: [
            {
              type: 'webhook',
              enabled: true,
              id: 'trigger-id',
            },
          ],
          edges: [
            {
              id: 'edge-id',
              target_job_id: 'job-a',
              enabled: true,
              source_trigger_id: 'trigger-id',
              condition_type: 'always',
            },
          ],
        },
      ],
    }),
  });

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'staging',
      workspace: '/ws1',
    },
    logger
  );

  // config file should be correct
  const yaml = fs.readFileSync('/ws1/openfn.yaml', 'utf8');
  t.is(
    yaml,
    `credentials: credentials.yaml
dirs:
  projects: p
  workflows: w
formats:
  openfn: yaml
  project: json
  workflow: json
`
  );

  // project metadata is written to the checkout file
  const checkout = fs.readFileSync('/ws1/.openfn/checkout.yaml', 'utf8');
  t.is(
    checkout,
    `alias: staging
id: staging
name: Staging
uuid: <uuid:staging>
`
  );

  // workflow file should be correct
  const wf = fs.readFileSync(
    '/ws1/w/simple-workflow/simple-workflow.json',
    'utf8'
  );

  t.deepEqual(JSON.parse(wf), {
    id: 'simple-workflow',
    name: 'Simple Workflow',
    start: 'webhook',
    steps: [
      {
        id: 'webhook',
        type: 'webhook',
        next: {
          'transform-data-to-fhir-standard': {
            disabled: false,
            condition: 'always',
          },
        },
      },
      {
        id: 'transform-data-to-fhir-standard',
        name: 'Transform data to FHIR standard',
        adaptor: '@openfn/language-http@latest',
        expression: './transform-data-to-fhir-standard.js',
      },
    ],
  });
});

test.serial(
  'checkout: removes old workflow directory when workflow is renamed on server',
  async (t) => {
    mock({
      '/ws3/workflows/old-workflow': {
        'old-workflow.yaml': jsonToYaml({
          id: 'old-workflow',
          steps: [{ id: 'run-job', expression: './run-job.js' }],
        }),
        'run-job.js': 'fn(state => state)',
      },
      '/ws3/openfn.yaml': jsonToYaml({ project: { id: 'main-project' } }),
      '/ws3/.projects/main-project@server.yaml': jsonToYaml({
        id: '<uuid:main>',
        name: 'Main Project',
        workflows: [
          {
            name: 'New Workflow',
            jobs: [{ name: 'Run Job', body: 'fn(s => s)' }],
            triggers: [],
            edges: [],
          },
        ],
      }),
    });

    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'main-project',
        workspace: '/ws3',
        // the project on-disk has diverged from the statefile, so we need to force it through
        force: true,
      },
      logger
    );

    t.false(fs.existsSync('/ws3/workflows/old-workflow'));
    t.true(fs.existsSync('/ws3/workflows/new-workflow'));
  }
);

test.serial(
  'checkout: removes old step file when step is renamed on server',
  async (t) => {
    mock({
      '/ws4/workflows/my-workflow': {
        'my-workflow.yaml': jsonToYaml({
          id: 'my-workflow',
          steps: [{ id: 'old-step', expression: './old-step.js' }],
        }),
        'old-step.js': 'fn(state => state)',
      },
      '/ws4/openfn.yaml': jsonToYaml({ project: { id: 'main-project' } }),
      '/ws4/.projects/main-project@server.yaml': jsonToYaml({
        id: '<uuid:main>',
        name: 'Main Project',
        workflows: [
          {
            name: 'My Workflow',
            jobs: [{ name: 'New Step', body: 'fn(s => s)' }],
            triggers: [],
            edges: [],
          },
        ],
      }),
    });

    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'main-project',
        workspace: '/ws4',
        // the project on-disk has diverged from the statefile, so we need to force it through
        force: true,
      },
      logger
    );

    t.false(fs.existsSync('/ws4/workflows/my-workflow/old-step.js'));
    t.true(fs.existsSync('/ws4/workflows/my-workflow/new-step.js'));
    t.true(fs.existsSync('/ws4/workflows/my-workflow'));
  }
);

test.serial('checkout: creates credentials.yaml', async (t) => {
  mock({
    '/ws2/workflows': {},
    '/ws2/openfn.yaml': jsonToYaml({
      project: { id: 'main-project' },
    }),
    '/ws2/.projects/main-project@server.yaml': jsonToYaml({
      id: '<uuid:main>',
      name: 'Main Project',
      project_credentials: [
        {
          id: 'cred-uuid',
          name: 'my-credential',
          owner: 'alice',
        },
      ],
      workflows: [
        {
          name: 'My Workflow',
          jobs: [
            {
              name: 'Run Job',
              body: 'fn(s => s)',
              adaptor: '@openfn/language-http@latest',
              project_credential_id: 'cred-uuid',
            },
          ],
          triggers: [],
          edges: [],
        },
      ],
    }),
  });

  t.false(fs.existsSync('/ws2/credentials.yaml'));

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'main-project',
      workspace: '/ws2',
      createCredentials: true,
    },
    logger
  );

  t.true(fs.existsSync('/ws2/credentials.yaml'));

  const creds = yamlToJson(fs.readFileSync('/ws2/credentials.yaml', 'utf8'));
  t.deepEqual(creds, { 'alice|my-credential': {} });
});

test.serial('checkout: do not create credentials.yaml', async (t) => {
  mock({
    '/ws2/workflows': {},
    '/ws2/openfn.yaml': jsonToYaml({
      project: { id: 'main-project' },
    }),
    '/ws2/.projects/main-project@server.yaml': jsonToYaml({
      id: '<uuid:main>',
      name: 'Main Project',
      project_credentials: [
        {
          id: 'cred-uuid',
          name: 'my-credential',
          owner: 'alice',
        },
      ],
      workflows: [
        {
          name: 'My Workflow',
          jobs: [
            {
              name: 'Run Job',
              body: 'fn(s => s)',
              adaptor: '@openfn/language-http@latest',
              project_credential_id: 'cred-uuid',
            },
          ],
          triggers: [],
          edges: [],
        },
      ],
    }),
  });

  t.false(fs.existsSync('/ws2/credentials.yaml'));

  await checkoutHandler(
    {
      command: 'project-checkout',
      project: 'main-project',
      workspace: '/ws2',
      createCredentials: false,
    },
    logger
  );

  t.false(fs.existsSync('/ws2/credentials.yaml'));
});
test.serial(
  'checkout: removes workflow directory when workflow is deleted on server',
  async (t) => {
    mock({
      '/ws5/workflows/workflow-a': {
        'workflow-a.yaml': jsonToYaml({
          id: 'workflow-a',
          steps: [{ id: 'run-job', expression: './run-job.js' }],
        }),
        'run-job.js': 'fn(state => state)',
      },
      '/ws5/workflows/workflow-b': {
        'workflow-b.yaml': jsonToYaml({ id: 'workflow-b', steps: [] }),
      },
      '/ws5/openfn.yaml': jsonToYaml({ project: { id: 'main-project' } }),
      '/ws5/.projects/main-project@server.yaml': jsonToYaml({
        id: '<uuid:main>',
        name: 'Main Project',
        workflows: [
          {
            name: 'Workflow A',
            jobs: [{ name: 'Run Job', body: 'fn(s => s)' }],
            triggers: [],
            edges: [],
          },
        ],
      }),
    });

    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'main-project',
        workspace: '/ws5',
        // the project on-disk has diverged from the statefile, so we need to force it through
        force: true,
      },
      logger
    );

    t.false(fs.existsSync('/ws5/workflows/workflow-b'));
    t.true(fs.existsSync('/ws5/workflows/workflow-a'));
  }
);

test.serial(
  'checkout: writes fetched collections into resources.yaml',
  async (t) => {
    mock({
      '/ws6/workflows': {},
      '/ws6/openfn.yaml': jsonToYaml({ project: { id: 'main-project' } }),
      '/ws6/.projects/main-project@server.yaml': jsonToYaml({
        id: '<uuid:main>',
        name: 'Main Project',
        collections: [
          { id: 'coll-id-1', name: 'my-collection' },
          { id: 'coll-id-2', name: 'another-collection' },
        ],
        workflows: [],
      }),
    });

    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'main-project',
        workspace: '/ws6',
      },
      logger
    );

    const resources: any = yamlToJson(
      fs.readFileSync('/ws6/resources.yaml', 'utf8')
    );
    // ids should never be written to disk - only names
    t.deepEqual(resources.collections, {
      'my-collection': {},
      'another-collection': {},
    });

    // collections don't belong in openfn.yaml
    const openfn: any = yamlToJson(fs.readFileSync('/ws6/openfn.yaml', 'utf8'));
    t.falsy(openfn.collections);
  }
);

/**
 * Using projects foo and bar here which come from a real issue
 * Keeping those exact state files to keep diversity in the tests
 */
const foo = `id: foo
name: foo
schema_version: '4.0'
collections: []
channels: []
credentials:
  - uuid: 8c675997-117b-4e8a-a65e-1ddea0d0e525
    name: name
    owner: editor@openfn.org
openfn:
  uuid: 44c0c920-5635-4984-ade2-b95fb24cbaf0
  endpoint: http://localhost:4000
  inserted_at: 2025-10-15T11:29:36Z
  updated_at: 2026-03-17T11:59:53Z
options:
  env: main
  allow_support_access: false
  requires_mfa: false
  retention_policy: retain_all
workflows:
  - name: A
    steps:
      - id: aaa
        name: aaa
        expression: // abc
        adaptor: '@openfn/language-common@latest'
        openfn:
          uuid: 7b6a6de4-eed2-4204-8ac0-4da8fa64206c
        next:
          bbb:
            disabled: false
            condition: on_job_success
            openfn:
              uuid: 64f1b20f-bfdf-4626-87de-403008cfb05d
      - id: bbb
        name: bbb
        expression: '2'
        adaptor: '@openfn/language-common@3.3.1'
        openfn:
          uuid: 832f5560-69c5-4eae-89cc-823b93af82c8
      - id: webhook
        type: webhook
        enabled: true
        webhook_reply: before_start
        openfn:
          uuid: 16ddedbb-1d70-44b7-8653-26f8dc802757
        next:
          aaa:
            disabled: false
            condition: always
            openfn:
              uuid: eccb03ef-990d-4ca7-877b-5452bbc8f63b
    history:
      - app:0a97362c97b3
      - app:8eb248f07744
    openfn:
      uuid: 4b2c13aa-2497-421a-9bb2-783309254130
      updated_at: 2026-05-14T10:25:36Z
      inserted_at: 2026-05-14T10:25:10Z
      lock_version: 6
    id: a
    start: webhook
`;
const bar = `id: bar
name: bar
schema_version: '4.0'
cli:
  forked_from:
    a: cli:145ff1ae62e5
collections: []
channels: []
credentials: []
openfn:
  uuid: 7c478de6-4c82-427d-aad2-875b1b9eccb8
  endpoint: http://localhost:4000
  alias: staging
  inserted_at: 2026-05-26T16:27:05Z
  updated_at: 2026-05-26T16:27:05Z
options:
  allow_support_access: false
  requires_mfa: false
  retention_policy: retain_all
workflows:
  - name: A
    steps:
      - id: aaa
        name: aaa
        expression: // 2
        adaptor: '@openfn/language-common@latest'
        openfn:
          uuid: 8227ae53-81f8-447f-bb93-213d5721f884
        next:
          bbb:
            disabled: false
            condition: on_job_success
            openfn:
              uuid: 474d6861-bb47-4fad-953d-a7762751bae0
      - id: bbb
        name: bbb
        expression: '2'
        adaptor: '@openfn/language-http@7.2.11'
        openfn:
          uuid: 862bec16-ef94-4438-b307-8594a70276fe
      - id: webhook
        type: webhook
        enabled: false
        webhook_reply: before_start
        openfn:
          uuid: d7dfdd68-ecb8-4adc-90cf-8a4ed8cc0235
        next:
          aaa:
            disabled: false
            condition: always
            openfn:
              uuid: 067cab97-bef8-4d70-b484-5d013d27142b
    history:
      - cli:145ff1ae62e5
    openfn:
      uuid: 9746c1d9-1499-4413-9edc-c23577e9308e
      inserted_at: 2026-05-26T16:27:05Z
      updated_at: 2026-05-26T16:27:05Z
      lock_version: 1
    id: a
    start: webhook
`;

test.serial(
  'Checkout unrelated bar from unrelated project foo without divergence warning',
  async (t) => {
    mock({
      '/tmp/openfn.yaml': '',
      '/tmp/.projects/main@server.yaml': foo,
      '/tmp/.projects/staging@server.yaml': bar,
    });

    // first checkout foo to set up the file system
    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'foo',
        workspace: '/tmp',
      },
      logger
    );

    // assert that staging was checked out ok
    let openfn = yamlToJson(
      fs.readFileSync('/tmp/.openfn/checkout.yaml', 'utf8')
    );
    t.is(openfn.id, 'foo');

    let expression = fs.readFileSync('/tmp/workflows/a/aaa.js', 'utf8');
    t.is(expression, '// abc');

    // now checkout bar
    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'bar',
        workspace: '/tmp',
      },
      logger
    );
    logger._reset();

    // assert that main was checked out ok
    openfn = yamlToJson(fs.readFileSync('/tmp/.openfn/checkout.yaml', 'utf8'));
    t.is(openfn.id, 'bar');

    expression = fs.readFileSync('/tmp/workflows/a/aaa.js', 'utf8');
    t.is(expression, '// 2');
  }
);

test.serial(
  'Checkout unrelated foo from unrelated project bar without divergence warning',
  async (t) => {
    mock({
      '/tmp/openfn.yaml': '',
      '/tmp/.projects/main@server.yaml': foo,
      '/tmp/.projects/staging@server.yaml': bar,
    });

    // first checkout bar to set up the file system
    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'bar',
        workspace: '/tmp',
      },
      logger
    );
    logger._reset();

    // assert that main was checked out ok
    let openfn = yamlToJson(
      fs.readFileSync('/tmp/.openfn/checkout.yaml', 'utf8')
    );
    t.is(openfn.id, 'bar');

    let expression = fs.readFileSync('/tmp/workflows/a/aaa.js', 'utf8');
    t.is(expression, '// 2');

    // now checkout foo
    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'foo',
        workspace: '/tmp',
      },
      logger
    );

    // assert that staging was checked out ok
    openfn = yamlToJson(fs.readFileSync('/tmp/.openfn/checkout.yaml', 'utf8'));
    t.is(openfn.id, 'foo');

    expression = fs.readFileSync('/tmp/workflows/a/aaa.js', 'utf8');
    t.is(expression, '// abc');
  }
);

test.serial(
  'If the checked out project has diverged from the tracked version, show a divergence warning on checkout',
  async (t) => {
    mock({
      '/tmp/openfn.yaml': '',
      '/tmp/.projects/main@server.yaml': foo,
      '/tmp/.projects/staging@server.yaml': bar,
    });

    await checkoutHandler(
      {
        command: 'project-checkout',
        project: 'bar',
        workspace: '/tmp',
      },
      logger
    );
    logger._reset();

    // assert that main was checked out ok
    let openfn = yamlToJson(
      fs.readFileSync('/tmp/.openfn/checkout.yaml', 'utf8')
    );
    t.is(openfn.id, 'bar');

    // Now make a change - on checkout, this change will be lost (it is not saved anywhere)
    fs.writeFileSync('/tmp/workflows/a/aaa.js', 'foobar');

    // now try to checkout foo
    await t.throwsAsync(
      () =>
        checkoutHandler(
          {
            command: 'project-checkout',
            project: 'foo',
            workspace: '/tmp',
          },
          logger
        ),
      {
        message: 'main has diverged from staging!',
      }
    );
  }
);

// Ad-hoc checkouts: checking out a project on a git branch that tracks a
// different project. dev tracks staging, and we try to checkout the main project
const adHocSetup = () => {
  fs.mkdirSync('/ws/.openfn/branches/dev', { recursive: true });
  fs.writeFileSync(
    '/ws/.openfn/branches/dev/checkout.yaml',
    'id: staging\nuuid: <uuid:staging>\n'
  );
};

// The prompt needs a terminal (without one, ad-hoc checkouts abort)
const withTTY = async (fn: () => Promise<unknown>) => {
  const stdin: any = process.stdin;
  const original = stdin.isTTY;
  stdin.isTTY = true;
  try {
    await fn();
  } finally {
    stdin.isTTY = original;
  }
};

const adHocCheckout = (log: any, extra = {}) =>
  checkoutHandler(
    {
      command: 'project-checkout',
      project: 'project',
      workspace: '/ws',
      branch: 'dev',
      ...extra,
    },
    log
  );

// The real logger skips the prompt if confirm() is called with force=true,
// but the mock always records and approves, so spy on the arguments instead
const spyLogger = (answer = true) => {
  const calls: Array<{ message: string; skip?: boolean }> = [];
  const log: any = {
    ...createMockLogger(undefined, { level: 'debug' }),
    confirm: async (message: string, skip?: boolean) => {
      calls.push({ message, skip });
      return answer;
    },
  };
  return { log, calls };
};

test.serial(
  'checkout: asks for confirmation on an ad-hoc checkout',
  async (t) => {
    adHocSetup();
    const { log, calls } = spyLogger();

    await withTTY(() => adHocCheckout(log));

    t.is(calls.length, 1);
    t.regex(calls[0].message, /Continue and checkout .* anyway/);
    t.falsy(calls[0].skip);
    // the files were expanded
    t.true(fs.existsSync('/ws/workflows/simple-workflow-main'));
    // but the branch still tracks staging
    t.is(
      fs.readFileSync('/ws/.openfn/branches/dev/checkout.yaml', 'utf8'),
      'id: staging\nuuid: <uuid:staging>\n'
    );
  }
);

test.serial(
  'checkout: does nothing if the user declines an ad-hoc checkout',
  async (t) => {
    adHocSetup();
    const { log } = spyLogger(false);

    await withTTY(() => adHocCheckout(log));

    t.false(fs.existsSync('/ws/workflows/simple-workflow-main'));
  }
);

test.serial('checkout: -f skips the ad-hoc confirmation', async (t) => {
  adHocSetup();
  const { log, calls } = spyLogger();

  await adHocCheckout(log, { force: true });

  t.true(calls[0].skip);
  t.true(fs.existsSync('/ws/workflows/simple-workflow-main'));
});

test.serial('checkout: -y skips the ad-hoc confirmation', async (t) => {
  adHocSetup();
  const { log, calls } = spyLogger();

  await adHocCheckout(log, { confirm: false });

  t.true(calls[0].skip);
  t.true(fs.existsSync('/ws/workflows/simple-workflow-main'));
});

test.serial(
  'checkout: does not ask for confirmation if the branch is not tracking something else',
  async (t) => {
    fs.mkdirSync('/ws/.openfn/branches/dev', { recursive: true });
    fs.writeFileSync(
      '/ws/.openfn/branches/dev/checkout.yaml',
      'id: main\nuuid: <uuid:main>\n'
    );
    const { log, calls } = spyLogger();

    await adHocCheckout(log);

    t.is(calls.length, 0);
  }
);

test.serial(
  'checkout: aborts an ad-hoc checkout with no terminal and no -f or -y',
  async (t) => {
    adHocSetup();
    const { log, calls } = spyLogger();
    const exitCode = process.exitCode;

    await t.throwsAsync(adHocCheckout(log), {
      message: 'Ad-hoc checkout needs to be confirmed',
    });
    // abort() flags the process as failed: don't let that leak out of the test
    process.exitCode = exitCode;

    t.is(calls.length, 0);
    t.false(fs.existsSync('/ws/workflows/simple-workflow-main'));
  }
);
