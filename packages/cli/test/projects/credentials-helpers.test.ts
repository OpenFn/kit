import test from 'ava';
import Project from '@openfn/project';

import {
  byNone,
  byAll,
  byPrune,
  byMap,
  remapCredentials,
} from '../../src/projects/credentials-helpers';

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

test('byNone drops every credential', (t) => {
  const project = createProject(
    [{ name: 'a', owner: 'joe@openfn.org' }],
    [step('x', 'joe@openfn.org|a')]
  );

  remapCredentials(project, byNone);

  t.deepEqual(project.credentials, []);
  t.is(project.workflows[0].steps[0].configuration, undefined);
});

test('byAll keeps every credential and reference untouched', (t) => {
  const project = createProject(
    [{ name: 'a', owner: 'joe@openfn.org' }],
    [step('x', 'joe@openfn.org|a')]
  );

  remapCredentials(project, byAll);

  t.deepEqual(project.credentials, [
    { name: 'a', owner: 'joe@openfn.org' },
  ]);
  t.is(project.workflows[0].steps[0].configuration, 'joe@openfn.org|a');
});

test('byPrune drops credentials not referenced by any step', (t) => {
  const project = createProject(
    [
      { name: 'a', owner: 'joe@openfn.org' },
      { name: 'unused', owner: 'joe@openfn.org' },
    ],
    [step('x', 'joe@openfn.org|a')]
  );

  remapCredentials(project, byPrune(project));

  t.deepEqual(project.credentials, [
    { name: 'a', owner: 'joe@openfn.org' },
  ]);
  t.is(project.workflows[0].steps[0].configuration, 'joe@openfn.org|a');
});

test('byMap drops credentials not named in the map', (t) => {
  const project = createProject(
    [
      { name: 'a', owner: 'joe@openfn.org' },
      { name: 'b', owner: 'joe@openfn.org' },
    ],
    [step('x', 'joe@openfn.org|a'), step('y', 'joe@openfn.org|b')]
  );

  remapCredentials(project, byMap({ a: { name: 'a' } }));

  t.deepEqual(project.credentials, [
    { name: 'a', owner: 'joe@openfn.org' },
  ]);
  t.is(project.workflows[0].steps[0].configuration, 'joe@openfn.org|a');
  t.is(project.workflows[0].steps[1].configuration, undefined);
});

test('byMap renames a credential and rewrites its step references', (t) => {
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
});
