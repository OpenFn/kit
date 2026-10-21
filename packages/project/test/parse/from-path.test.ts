import test from 'ava';
import { mockFs, restoreFs } from '@openfn/test-helpers';

import { generateProject } from '../../src';
import fromPath, { extractAliasFromFilename } from '../../src/parse/from-path';
import * as v2 from '../fixtures/sample-v2-project';

test.afterEach(restoreFs);

const proj = generateProject('my-project', ['a-b'], {
  openfnUuid: true,
});

test.serial('should load a v1 state json', async (t) => {
  mockFs({
    '/p1/main@openfn.org.json': JSON.stringify(
      proj.serialize('state', { format: 'json' })
    ),
  });
  const project = await fromPath('/p1/main@openfn.org.json');

  t.is(project.name, proj.name);
  t.deepEqual(project.openfn!.uuid, proj.openfn!.uuid);

  // TODO this isn't quite right for a few reasons
  // will investigate later
  // t.deepEqual(project.workflows[0].workflow, proj.workflows[0].workflow);
});

test.serial('should load a v1 state yaml', async (t) => {
  mockFs({
    // @ts-ignore
    '/p1/main@openfn.org.yaml': proj.serialize('state', { format: 'yaml' }),
  });
  const project = await fromPath('/p1/main@openfn.org.yaml');

  t.is(project.name, proj.name);
  t.deepEqual(project.openfn!.uuid, proj.openfn!.uuid);

  // TODO this isn't quite right for a few reasons
  // will investigate later
  // t.deepEqual(project.workflows[0].workflow, proj.workflows[0].workflow);
});

test.serial('should load a v2 project yaml', async (t) => {
  mockFs({
    '/p1/main@openfn.org.yaml': v2.yaml,
  });
  const project = await fromPath('/p1/main@openfn.org.yaml');

  t.is(project.id, proj.id);
  t.deepEqual(project.openfn!.uuid, '1234');
  t.is(project.workflows.length, 1);
});

test.serial('should load a v2 project json', async (t) => {
  mockFs({
    '/p1/main@openfn.org.json': JSON.stringify(v2.json),
  });
  const project = await fromPath('/p1/main@openfn.org.json');

  t.is(project.id, proj.id);
  t.deepEqual(project.openfn!.uuid, '1234');
  t.is(project.workflows.length, 1);
});

test.serial('should use workspace config', async (t) => {
  mockFs({
    // @ts-ignore
    '/p1/main@openfn.org.yaml': proj.serialize('state', { format: 'yaml' }),
  });
  const config = {
    x: 1234,
    dirs: {
      projects: 'p',
      workflows: 'w',
    },
  };
  const project = await fromPath('/p1/main@openfn.org.yaml', config);

  t.is(project.name, proj.name);
  t.deepEqual(project.config, {
    credentials: 'credentials.yaml',
    dirs: {
      projects: 'p',
      workflows: 'w',
    },
    formats: {
      openfn: 'yaml',
      project: 'yaml',
      workflow: 'yaml',
    },
    x: 1234,
  });

  t.deepEqual(project.openfn!.uuid, proj.openfn!.uuid);
});

test.serial('should apply a name override to a loaded project', async (t) => {
  mockFs({
    '/p1/main@openfn.org.yaml': v2.yaml,
  });
  const project = await fromPath('/p1/main@openfn.org.yaml', {
    name: 'My Duplicate',
  });

  t.is(project.name, 'My Duplicate');
});

test.serial(
  'extractAliasFromFilename: should extract alias from alias@domain.yaml format',
  (t) => {
    const alias = extractAliasFromFilename('main@app.openfn.org.yaml');
    t.is(alias, 'main');
  }
);

test.serial(
  'extractAliasFromFilename: should extract alias from alias@domain.json format',
  (t) => {
    const alias = extractAliasFromFilename('staging@localhost.json');
    t.is(alias, 'staging');
  }
);

test.serial(
  'extractAliasFromFilename: should extract alias from simple filename',
  (t) => {
    const alias = extractAliasFromFilename('production.yaml');
    t.is(alias, 'production');
  }
);

test.serial('extractAliasFromFilename: should handle full paths', (t) => {
  const alias = extractAliasFromFilename('/path/to/dev@app.openfn.org.yaml');
  t.is(alias, 'dev');
});

test.serial('extractAliasFromFilename: should handle complex aliases', (t) => {
  const alias = extractAliasFromFilename(
    'my-project-staging@app.openfn.org.yaml'
  );
  t.is(alias, 'my-project-staging');
});
