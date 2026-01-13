import test from 'ava';
import mock from 'mock-fs';

import { generateProject } from '../../src';
import fromPath, { extractAliasFromFilename } from '../../src/parse/from-path';
import * as v2 from '../fixtures/sample-v2-project';

const proj = generateProject('my-project', ['a-b'], {
  openfnUuid: true,
});

test.serial('should load a v1 state json', async (t) => {
  mock({
    '/p1/main@openfn.org.json': JSON.stringify(
      proj.serialize('state', { format: 'json' })
    ),
  });
  const project = await fromPath('/p1/main@openfn.org.json');

  t.is(project.name, proj.name);
  t.deepEqual(project.openfn.uuid, proj.openfn.uuid);

  // TODO this isn't quite right for a few reasons
  // will investigate later
  // t.deepEqual(project.workflows[0].workflow, proj.workflows[0].workflow);
});

test.serial('should load a v1 state yaml', async (t) => {
  mock({
    '/p1/main@openfn.org.yaml': proj.serialize('state', { format: 'yaml' }),
  });
  const project = await fromPath('/p1/main@openfn.org.yaml');

  t.is(project.name, proj.name);
  t.deepEqual(project.openfn.uuid, proj.openfn.uuid);

  // TODO this isn't quite right for a few reasons
  // will investigate later
  // t.deepEqual(project.workflows[0].workflow, proj.workflows[0].workflow);
});

test.serial('should load a v2 project yaml', async (t) => {
  mock({
    '/p1/main@openfn.org.yaml': v2.yaml,
  });
  const project = await fromPath('/p1/main@openfn.org.yaml');

  t.is(project.id, proj.id);
  t.deepEqual(project.openfn.uuid, '1234');
  t.is(project.workflows.length, 1);
});

test.serial('should load a v2 project json', async (t) => {
  mock({
    '/p1/main@openfn.org.json': JSON.stringify(v2.json),
  });
  const project = await fromPath('/p1/main@openfn.org.json');

  t.is(project.id, proj.id);
  t.deepEqual(project.openfn.uuid, '1234');
  t.is(project.workflows.length, 1);
});

test.serial('should use workspace config', async (t) => {
  mock({
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

  t.deepEqual(project.openfn.uuid, proj.openfn.uuid);
});

test('extractAliasFromFilename: should extract alias from alias@domain.yaml format', (t) => {
  const alias = extractAliasFromFilename('main@app.openfn.org.yaml');
  t.is(alias, 'main');
});

test('extractAliasFromFilename: should extract alias from alias@domain.json format', (t) => {
  const alias = extractAliasFromFilename('staging@localhost.json');
  t.is(alias, 'staging');
});

test('extractAliasFromFilename: should extract alias from simple filename', (t) => {
  const alias = extractAliasFromFilename('production.yaml');
  t.is(alias, 'production');
});

test('extractAliasFromFilename: should handle full paths', (t) => {
  const alias = extractAliasFromFilename('/path/to/dev@app.openfn.org.yaml');
  t.is(alias, 'dev');
});

test('extractAliasFromFilename: should handle complex aliases', (t) => {
  const alias = extractAliasFromFilename(
    'my-project-staging@app.openfn.org.yaml'
  );
  t.is(alias, 'my-project-staging');
});
