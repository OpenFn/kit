import test from 'ava';
import fs from 'node:fs';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import Project, { Workspace, yamlToJson } from '@openfn/project';

import ensureCheckout, {
  describeProject,
  getDefaultProject,
} from '../../src/projects/ensure-checkout';

const logger = createMockLogger(undefined, { level: 'debug' });

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

const projectFile = (id: string) =>
  new Project({
    id,
    name: id,
    openfn: { uuid: `uuid-${id}`, endpoint: 'https://app.openfn.org' },
    workflows: [{ id: 'wf', name: 'wf', history: ['abc'], steps: [] }],
  }).serialize('project', { format: 'yaml' }) as string;

const setup = (ids = ['main', 'staging'], extra = {}) =>
  mock({
    '/ws/openfn.yaml': '',
    '/ws/workflows/wf/wf.yaml': 'id: wf',
    ...Object.fromEntries(
      ids.map((id) => [
        `/ws/.projects/${id}@app.openfn.org.yaml`,
        projectFile(id),
      ])
    ),
    ...extra,
  });

const readCheckout = (path = '/ws/.openfn/checkout.yaml') =>
  yamlToJson(fs.readFileSync(path, 'utf8'));

// A prompt that records what it was asked and picks a project by alias
const pickPrompt = (alias: string) => {
  const calls: any[] = [];
  const prompt = async (projects: Project[], defaultProject: Project) => {
    calls.push({ projects, defaultProject });
    return projects.find((p) => p.alias === alias)!;
  };
  return { prompt, calls };
};

const neverPrompt = async () => {
  throw new Error('should not have prompted');
};

test.serial('does nothing if there is already checkout metadata', async (t) => {
  setup(['main', 'staging'], { '/ws/.openfn/checkout.yaml': 'id: main' });
  const workspace = new Workspace('/ws', logger);

  const result = await ensureCheckout(workspace, logger, {
    interactive: true,
    prompt: neverPrompt,
  });

  t.is(result, workspace);
  t.is(readCheckout().id, 'main');
});

test.serial('does nothing if there are no tracked projects', async (t) => {
  setup([]);
  const workspace = new Workspace('/ws', logger, false);

  const result = await ensureCheckout(workspace, logger, {
    interactive: true,
    prompt: neverPrompt,
  });

  t.is(result, workspace);
  t.false(fs.existsSync('/ws/.openfn'));
});

test.serial('uses the only tracked project without prompting', async (t) => {
  setup(['main']);

  const result = await ensureCheckout(new Workspace('/ws', logger), logger, {
    interactive: true,
    prompt: neverPrompt,
  });

  t.is(readCheckout().uuid, 'uuid-main');
  t.is(result.activeProject?.uuid, 'uuid-main');
});

test.serial('prompts if there are several tracked projects', async (t) => {
  setup();
  const { prompt, calls } = pickPrompt('staging');

  const result = await ensureCheckout(new Workspace('/ws', logger), logger, {
    interactive: true,
    prompt,
  });

  // explain why we're asking
  t.truthy(logger._find('info', /Failed to find a checkout.yaml file/));
  t.truthy(logger._find('info', /just pick which project is checked out/));

  t.is(calls.length, 1);
  t.deepEqual(calls[0].projects.map((p: Project) => p.alias).sort(), [
    'main',
    'staging',
  ]);

  // the checkout file has been set up, and the workspace knows about it
  t.is(readCheckout().uuid, 'uuid-staging');
  t.is(result.activeProject?.uuid, 'uuid-staging');
});

test.serial(
  'does not set anything up if the user skips the prompt',
  async (t) => {
    setup();
    const workspace = new Workspace('/ws', logger);

    const result = await ensureCheckout(workspace, logger, {
      interactive: true,
      prompt: async () => null,
    });

    t.is(result, workspace);
    t.false(fs.existsSync('/ws/.openfn'));
    t.truthy(logger._find('info', /Skipped/));
  }
);

test.serial(
  'does not touch the workflows when setting up the checkout',
  async (t) => {
    setup();
    const { prompt } = pickPrompt('main');

    await ensureCheckout(new Workspace('/ws', logger), logger, {
      interactive: true,
      prompt,
    });

    t.deepEqual(fs.readdirSync('/ws').sort(), [
      '.openfn',
      '.projects',
      'openfn.yaml',
      'workflows',
    ]);
    t.is(fs.readFileSync('/ws/workflows/wf/wf.yaml', 'utf8'), 'id: wf');
    t.is(fs.readFileSync('/ws/openfn.yaml', 'utf8'), '');
  }
);

test.serial('suggests the project matching the git branch', async (t) => {
  setup(['main', 'staging']);
  const { prompt, calls } = pickPrompt('main');

  await ensureCheckout(
    new Workspace('/ws', logger, true, { branch: 'staging' }),
    logger,
    { interactive: true, prompt }
  );

  t.is(calls[0].defaultProject.alias, 'staging');
});

test.serial(
  'suggests main if there is no git branch, even if it is not first',
  async (t) => {
    // projects are listed alphabetically, so main is not first here
    setup(['alpha', 'main']);
    const { prompt, calls } = pickPrompt('alpha');

    await ensureCheckout(
      new Workspace('/ws', logger, true, { branch: false }),
      logger,
      { interactive: true, prompt }
    );

    t.is(calls[0].defaultProject.alias, 'main');
  }
);

test.serial('writes the checkout file for the branch', async (t) => {
  setup();
  const { prompt } = pickPrompt('staging');

  await ensureCheckout(
    new Workspace('/ws', logger, true, { branch: 'dev' }),
    logger,
    { interactive: true, prompt }
  );

  t.is(
    readCheckout('/ws/.openfn/branches/dev/checkout.yaml').uuid,
    'uuid-staging'
  );
  t.false(fs.existsSync('/ws/.openfn/checkout.yaml'));
});

test.serial(
  'aborts without prompting if several projects and not interactive',
  async (t) => {
    setup();
    const exitCode = process.exitCode;

    await t.throwsAsync(
      ensureCheckout(new Workspace('/ws', logger), logger, {
        interactive: false,
        prompt: neverPrompt,
      }),
      { message: 'No checked out project found' }
    );

    // abort() flags the process as failed: don't let that leak out of the test
    process.exitCode = exitCode;

    t.false(fs.existsSync('/ws/.openfn'));
    t.truthy(logger._find('error', /No checked out project found/));
  }
);

test.serial(
  'carries on without a checkout if not interactive and not required',
  async (t) => {
    setup();
    const workspace = new Workspace('/ws', logger);

    const result = await ensureCheckout(workspace, logger, {
      interactive: false,
      required: false,
      prompt: neverPrompt,
    });

    t.is(result, workspace);
    t.false(fs.existsSync('/ws/.openfn'));
  }
);

test.serial('still prompts if interactive, even if not required', async (t) => {
  setup();
  const { prompt, calls } = pickPrompt('staging');

  const result = await ensureCheckout(new Workspace('/ws', logger), logger, {
    interactive: true,
    required: false,
    prompt,
  });

  t.is(calls.length, 1);
  t.is(result.activeProject?.uuid, 'uuid-staging');
});

const projects = (aliases: string[]) =>
  aliases.map((alias) => ({ alias })) as unknown as Project[];

test('getDefaultProject: prefers the alias matching the branch', (t) => {
  const result = getDefaultProject(projects(['main', 'staging']), 'staging');
  t.is(result.alias, 'staging');
});

test('getDefaultProject: defaults to main if there is no branch', (t) => {
  t.is(getDefaultProject(projects(['a', 'main', 'b'])).alias, 'main');
});

test('getDefaultProject: falls back to the first project', (t) => {
  t.is(getDefaultProject(projects(['a', 'b']), 'feature').alias, 'a');
});

const described = (props: object) => describeProject(props as Project);

test('describeProject: alias with id and uuid', (t) => {
  t.is(
    described({ alias: 'staging', id: 'my-project', openfn: { uuid: 'abcd' } }),
    'staging (my-project | abcd)'
  );
});

test('describeProject: copes with a missing uuid or id', (t) => {
  t.is(
    described({ alias: 'staging', id: 'my-project' }),
    'staging (my-project)'
  );
  t.is(
    described({ alias: 'staging', openfn: { uuid: 'abcd' } }),
    'staging (abcd)'
  );
});

test('describeProject: just the alias if there is no id or uuid', (t) => {
  t.is(described({ alias: 'staging' }), 'staging');
});

test('describeProject: copes with a missing alias', (t) => {
  t.is(described({ id: 'my-project' }), '(no alias) (my-project)');
});
