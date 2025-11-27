import test from 'ava';
import mock from 'mock-fs';

import { generateProject } from '../../src';
import fromPath from '../../src/parse/from-path';
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
