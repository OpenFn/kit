import test from 'ava';
import fs from 'node:fs';
import { mockFs, restoreFs } from '@openfn/test-helpers';

import Project, { yamlToJson } from '@openfn/project';

import {
  byNone,
  byAll,
  byPrune,
  byMap,
  byCredentialsFile,
  loadCredentialsMapFromFile,
  getCredentialsVisitor,
  remapCredentials,
  findCredentialIds,
  createProjectCredentials,
  default as parseCredentialsOption,
} from '../../src/projects/credentials-helpers';

test.afterEach(restoreFs);

const createProject = (credentials: any[], steps: any[]) =>
  new Project({
    id: 'proj',
    workflows: [{ id: 'wf', steps }],
    credentials,
  });

const step = (id: string, configuration?: string) => ({
  id,
  adaptor: 'common',
  expression: 'fn(s => s)',
  configuration,
});

test.serial('byNone drops every credential', (t) => {
  const project = createProject(
    [{ name: 'a', owner: 'joe@openfn.org' }],
    [step('x', 'joe@openfn.org|a')]
  );

  remapCredentials(project, byNone);

  t.deepEqual(project.credentials, []);
  // null, not deleted - a merge-based redeploy needs an explicit removal
  // signal to actually clear the target's existing reference
  t.is(project.workflows[0].steps[0].configuration as any, null);
});

test.serial('byAll keeps every credential and reference untouched', (t) => {
  const project = createProject(
    [{ name: 'a', owner: 'joe@openfn.org' }],
    [step('x', 'joe@openfn.org|a')]
  );

  remapCredentials(project, byAll);

  t.deepEqual(project.credentials, [{ name: 'a', owner: 'joe@openfn.org' }]);
  t.is(project.workflows[0].steps[0].configuration, 'joe@openfn.org|a');
});

test.serial('byPrune drops credentials not referenced by any step', (t) => {
  const project = createProject(
    [
      { name: 'a', owner: 'joe@openfn.org' },
      { name: 'unused', owner: 'joe@openfn.org' },
    ],
    [step('x', 'joe@openfn.org|a')]
  );

  remapCredentials(project, byPrune(project));

  t.deepEqual(project.credentials, [{ name: 'a', owner: 'joe@openfn.org' }]);
  t.is(project.workflows[0].steps[0].configuration, 'joe@openfn.org|a');
});

test.serial('byMap drops credentials not named in the map', (t) => {
  const project = createProject(
    [
      { name: 'a', owner: 'joe@openfn.org' },
      { name: 'b', owner: 'joe@openfn.org' },
    ],
    [step('x', 'joe@openfn.org|a'), step('y', 'joe@openfn.org|b')]
  );

  remapCredentials(project, byMap({ a: { name: 'a' } }));

  t.deepEqual(project.credentials, [{ name: 'a', owner: 'joe@openfn.org' }]);
  t.is(project.workflows[0].steps[0].configuration, 'joe@openfn.org|a');
  t.is(project.workflows[0].steps[1].configuration as any, null);
});

test.serial(
  'byMap renames a credential and rewrites its step references',
  (t) => {
    const project = createProject(
      [{ name: 'c', owner: 'joe@openfn.org' }],
      [step('x', 'joe@openfn.org|c')]
    );

    remapCredentials(
      project,
      byMap({ c: { name: 'c', owner: 'other@openfn.org' } })
    );

    t.deepEqual(project.credentials, [
      { name: 'c', owner: 'other@openfn.org' },
    ]);
    t.is(project.workflows[0].steps[0].configuration, 'other@openfn.org|c');
  }
);

test.serial(
  'byCredentialsFile drops credentials not listed in the file, keeps listed ones',
  (t) => {
    const project = createProject(
      [
        { name: 'a', owner: 'joe@openfn.org' },
        { name: 'b', owner: 'joe@openfn.org' },
      ],
      [step('x', 'joe@openfn.org|a'), step('y', 'joe@openfn.org|b')]
    );

    remapCredentials(
      project,
      byCredentialsFile({ 'joe@openfn.org|a': undefined as any })
    );

    t.deepEqual(project.credentials, [{ name: 'a', owner: 'joe@openfn.org' }]);
    t.is(project.workflows[0].steps[0].configuration, 'joe@openfn.org|a');
    t.is(project.workflows[0].steps[1].configuration as any, null);
  }
);

test.serial(
  'byCredentialsFile renames a credential per its alias entry',
  (t) => {
    const project = createProject(
      [{ name: 'a', owner: 'joe@openfn.org' }],
      [step('x', 'joe@openfn.org|a')]
    );

    remapCredentials(
      project,
      byCredentialsFile({
        'joe@openfn.org|a': { name: 'renamed', owner: 'other@openfn.org' },
      })
    );

    t.deepEqual(project.credentials, [
      { name: 'renamed', owner: 'other@openfn.org' },
    ]);
    t.is(
      project.workflows[0].steps[0].configuration,
      'other@openfn.org|renamed'
    );
  }
);

test.serial(
  'loadCredentialsMapFromFile: an entry with no alias just marks inclusion',
  (t) => {
    mockFs({
      '/ws/credentials.yaml': `joe@openfn.org|a:
  user: someuser
`,
    });

    const map = loadCredentialsMapFromFile('/ws/credentials.yaml');
    t.deepEqual(map, { 'joe@openfn.org|a': undefined as any });
  }
);

test.serial(
  'loadCredentialsMapFromFile: an entry with an alias carries it through',
  (t) => {
    mockFs({
      '/ws/credentials.yaml': `joe@openfn.org|a:
  user: someuser
  alias: other@openfn.org|renamed
`,
    });

    const map = loadCredentialsMapFromFile('/ws/credentials.yaml');
    t.deepEqual(map, {
      'joe@openfn.org|a': { name: 'renamed', owner: 'other@openfn.org' },
    });
  }
);

test.serial(
  'getCredentialsVisitor: a credentials file path syncs only what it lists',
  (t) => {
    mockFs({
      '/ws/credentials.yaml': `joe@openfn.org|a:
  user: someuser
`,
    });

    const project = createProject(
      [
        { name: 'a', owner: 'joe@openfn.org' },
        { name: 'b', owner: 'joe@openfn.org' },
      ],
      [step('x', 'joe@openfn.org|a'), step('y', 'joe@openfn.org|b')]
    );

    remapCredentials(
      project,
      getCredentialsVisitor(project, 'credentials.yaml', '/ws')
    );

    t.deepEqual(project.credentials, [{ name: 'a', owner: 'joe@openfn.org' }]);
    t.is(project.workflows[0].steps[1].configuration as any, null);
  }
);

test.serial(
  'getCredentialsVisitor: throws when the --credentials map names a credential not in the project',
  (t) => {
    const project = createProject(
      [{ name: 'a', owner: 'joe@openfn.org' }],
      [step('x', 'joe@openfn.org|a')]
    );

    const error = t.throws(() =>
      getCredentialsVisitor(project, { typo: { name: 'typo' } })
    );

    t.regex(error!.message, /typo/);
  }
);

test.serial(
  'getCredentialsVisitor: throws when a credentials.yaml file names a credential not in the project',
  (t) => {
    mockFs({
      '/ws/credentials.yaml': `joe@openfn.org|not-a-real-credential:
  user: someuser
`,
    });

    const project = createProject(
      [{ name: 'a', owner: 'joe@openfn.org' }],
      [step('x', 'joe@openfn.org|a')]
    );

    const error = t.throws(() =>
      getCredentialsVisitor(project, 'credentials.yaml', '/ws')
    );

    t.regex(error!.message, /joe@openfn\.org\|not-a-real-credential/);
  }
);

test.serial(
  'getCredentialsVisitor: does not throw when every named credential exists',
  (t) => {
    const project = createProject(
      [{ name: 'a', owner: 'joe@openfn.org' }],
      [step('x', 'joe@openfn.org|a')]
    );

    t.notThrows(() =>
      getCredentialsVisitor(project, { a: { name: 'renamed' } })
    );
  }
);

test.serial(
  'parseCredentialsOption: a credentials file path passes through unchanged',
  (t) => {
    t.is(parseCredentialsOption('./credentials.yaml'), './credentials.yaml');
    t.is(parseCredentialsOption('creds.yml'), 'creds.yml');
    t.is(parseCredentialsOption('creds.json'), 'creds.json');
  }
);

test.serial('parseCredentialsOption: none', (t) => {
  t.is(parseCredentialsOption('none'), 'none');
});

test.serial('parseCredentialsOption: prune', (t) => {
  t.is(parseCredentialsOption('prune'), 'prune');
});

test.serial('parseCredentialsOption: all', (t) => {
  t.is(parseCredentialsOption('all'), 'all');
});

test.serial(
  'parseCredentialsOption: a single credential name with no alias',
  (t) => {
    const result = parseCredentialsOption('a');
    t.deepEqual(result, { a: { name: 'a' } });
  }
);

test.serial(
  'parseCredentialsOption: a comma separated list of credential names',
  (t) => {
    const result = parseCredentialsOption('a,b,c');
    t.deepEqual(result, {
      a: { name: 'a' },
      b: { name: 'b' },
      c: { name: 'c' },
    });
  }
);

test.serial(
  'parseCredentialsOption: a credential mapped to a new name and owner',
  (t) => {
    const result = parseCredentialsOption('c=joe@openfn.org|c');
    t.deepEqual(result, {
      c: { name: 'c', owner: 'joe@openfn.org' },
    });
  }
);

test.serial(
  'parseCredentialsOption: a mix of plain names and aliased names',
  (t) => {
    const result = parseCredentialsOption('a,b,c=joe@openfn.org|c');
    t.deepEqual(result, {
      a: { name: 'a' },
      b: { name: 'b' },
      c: { name: 'c', owner: 'joe@openfn.org' },
    });
  }
);

test.serial(
  'parseCredentialsOption: an alias with a new name but no owner',
  (t) => {
    const result = parseCredentialsOption('a=renamed');
    t.deepEqual(result, {
      a: { name: 'renamed', owner: undefined },
    });
  }
);

const baseWorkflow = (steps: any[]) => ({
  id: 'wf',
  name: 'wf',
  history: [],
  steps,
});

test.serial('findCredentialIds: inline string references', (t) => {
  const project = new Project({
    id: 'p',
    workflows: [
      baseWorkflow([
        { id: 'a', configuration: 'owner|cred' },
        { id: 'c', configuration: 'ignored.json' },
        { id: 'd', configuration: '' },
      ]),
    ],
  } as any);

  const ids = findCredentialIds(project);
  t.deepEqual(ids, ['owner|cred']);
});

test.serial('findCredentialIds: ignores duplicate references', (t) => {
  const project = new Project({
    id: 'p',
    workflows: [
      baseWorkflow([{ id: 'a', configuration: 'same' }]),
      baseWorkflow([{ id: 'b', configuration: 'same' }]),
    ],
  } as any);

  t.deepEqual(findCredentialIds(project), ['same']);
});

test.serial('createProjectCredentials: creates credential yaml file', (t) => {
  mockFs({ '/ws': {} });

  const project = new Project(
    {
      id: 'p',
      workflows: [baseWorkflow([{ id: 'j', configuration: 'new-id' }])],
    } as any,
    { credentials: 'credentials.yaml' }
  );

  createProjectCredentials('/ws', project);

  t.true(fs.existsSync('/ws/credentials.yaml'));
  const doc = yamlToJson(
    fs.readFileSync('/ws/credentials.yaml', 'utf8')
  ) as any;
  t.deepEqual(doc, { 'new-id': {} });
});

test.serial(
  'createProjectCredentials: preserves existing credentials and adds missing ones',
  (t) => {
    mockFs({
      '/ws': {},
      '/ws/credentials.yaml': `existing:
  password: secret
`,
    });

    const project = new Project(
      {
        id: 'p',
        workflows: [
          baseWorkflow([
            { id: 'j', configuration: 'existing' },
            { id: 'k', configuration: 'brand-new' },
          ]),
        ],
      } as any,
      { credentials: 'credentials.yaml' }
    );

    createProjectCredentials('/ws', project);

    const doc = yamlToJson(
      fs.readFileSync('/ws/credentials.yaml', 'utf8')
    ) as any;
    t.is(doc.existing.password, 'secret');
    t.deepEqual(doc['brand-new'], {});
  }
);
