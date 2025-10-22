import test from 'ava';
import mock from 'mock-fs';

import { generateProject } from '../../src';
import fromPath from '../../src/parse/from-path';

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

test.serial('should use workspace config', async (t) => {
  mock({
    '/p1/main@openfn.org.yaml': proj.serialize('state', { format: 'yaml' }),
  });
  const config = {
    x: 1234,
  };
  const project = await fromPath('/p1/main@openfn.org.yaml', {
    repo: config,
  });

  t.is(project.name, proj.name);
  t.deepEqual(project.openfn.uuid, proj.openfn.uuid);
  t.is(project.config.x, config.x);
});
