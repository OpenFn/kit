import test from 'ava';
import fs from 'node:fs';
import mock from 'mock-fs';

import Project from '@openfn/project';
import { yamlToJson } from '@openfn/project';

import {
  findCredentialIds,
  createProjectCredentials,
} from '../../src/projects/create-credentials';

test.afterEach(() => {
  try {
    mock.restore();
  } catch {}
});

const baseWorkflow = (steps: any[]) => ({
  id: 'wf',
  name: 'wf',
  history: [],
  steps,
});

test('sync-credentials: inline string references', (t) => {
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

test('sync-credentials: ignores duplicate references', (t) => {
  const project = new Project({
    id: 'p',
    workflows: [
      baseWorkflow([{ id: 'a', configuration: 'same' }]),
      baseWorkflow([{ id: 'b', configuration: 'same' }]),
    ],
  } as any);

  t.deepEqual(findCredentialIds(project), ['same']);
});

test.only('sync-credentials: creates credential yaml file', (t) => {
  mock({ '/ws': {} });

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

test('sync-credentials: preserves existing credentials and adds missing ones', (t) => {
  mock({
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
});
