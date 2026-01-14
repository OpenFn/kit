// should parse a project from app state and back again
import test from 'ava';
import type { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../src/Project';
import generateWorkflow from '../src/gen/generator';
import { UnsafeMergeError } from '../src/merge/merge-project';

// TODO move to fixtures and re-use?
// Or use util function instead?
const state: Provisioner.Project = {
  id: 'e16c5f09-f0cb-4ba7-a4c2-73fcb2f29d00',
  name: 'aaa',
  description: 'a project',
  concurrency: null,
  inserted_at: '2025-04-23T11:15:59Z',
  collections: [],
  workflows: [
    {
      id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      name: 'wf1',
      edges: [
        {
          enabled: true,
          id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
          source_trigger_id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          condition_type: 'always',
          target_job_id: '66add020-e6eb-4eec-836b-20008afca816',
        },
      ],
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      jobs: [
        {
          id: '66add020-e6eb-4eec-836b-20008afca816',
          name: 'Transform data',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
          keychain_credential_id: null,
        },
      ],
      triggers: [
        {
          enabled: true, // TODO enabled: false is a bit interesting
          id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          type: 'webhook',
        },
      ],
      lock_version: 1,
      deleted_at: null,
    },
  ],
  updated_at: '2025-04-23T11:15:59Z',
  project_credentials: [],
  scheduled_deletion: null,
  allow_support_access: false,
  requires_mfa: false,
  retention_policy: 'retain_all',
  history_retention_period: null,
  dataclip_retention_period: null,
};

test('should generate a correct qname with default values', (t) => {
  const project = new Project({}, {});

  t.is(project.qname, 'main');
});

test('should generate a correct qname with real values', (t) => {
  const project = new Project(
    {
      openfn: {
        endpoint: 'https://app.openfn.org',
      },
    },
    {
      alias: 'staging',
    }
  );

  t.is(project.qname, 'staging@app.openfn.org');
});

test('should generate a correct qname with weird values', (t) => {
  const project = new Project(
    {
      openfn: {
        endpoint: 'https://app.com/openfn',
      },
    },
    { alias: 'hello' }
  );

  t.is(project.qname, 'hello@app.com');
});

test('should return an alias', (t) => {
  const project = new Project(
    {},
    {
      alias: 'staging',
    }
  );

  t.is(project.alias, 'staging');
});

test('should default alias to "main"', (t) => {
  const project = new Project();

  t.is(project.alias, 'main');
});

test('should convert a state file to a project and back again', async (t) => {
  const meta = {
    endpoint: 'app.openfn.org',
    env: 'test',
  };

  const project = await Project.from('state', state, meta, { format: 'json' });
  t.is(project.openfn?.env, 'test');
  t.is(project.openfn?.endpoint, 'app.openfn.org');
  t.is(project.openfn?.uuid, state.id);
  t.is(project.name, state.name);

  // TODO: this hack is needed right now to serialize the state as json
  project.config.formats.project = 'json';

  const newState = project.serialize('state');
  t.deepEqual(newState, state);
});

// Note that this is mostly tested under merge-project
// This is testing the static function on Project, which is just a proxy
test('should merge two projects', (t) => {
  const wf_a = generateWorkflow(`a(expression="a()")-b a-c`);

  const wf_b = generateWorkflow(`a(expression="b()")-b a-c`);

  const main = new Project({
    name: 'a',
    workflows: [wf_a],
  });
  const staging = new Project({
    name: 'b',
    workflows: [wf_b],
  });

  const result = Project.merge(staging, main);

  t.is(result.name, 'a');
  const mergedStep = result.workflows[0].get('a');

  t.is(mergedStep.expression, 'b()');
  t.is(mergedStep.openfn.uuid, wf_a.get('a').openfn.uuid);
});

test('should return UUIDs for everything', async (t) => {
  const project = await Project.from('state', state, {});
  const map = project.getUUIDMap();
  t.deepEqual(map, {
    wf1: {
      self: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      children: {
        trigger: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
        'trigger-transform-data': 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
        'transform-data': '66add020-e6eb-4eec-836b-20008afca816',
      },
    },
  });
});

test('incompatible-merge: should throw error when merge is incompatible', (t) => {
  const source = generateWorkflow('trigger-x');
  source.pushHistory(source.getVersionHash());
  const target = generateWorkflow('trigger-y');
  target.pushHistory(target.getVersionHash());

  t.false(source.canMergeInto(target));

  const sourceProject = new Project({ workflows: [source] });
  const targetProject = new Project({ workflows: [target] });
  t.throws(
    () => Project.merge(sourceProject, targetProject, { force: false }),
    {
      instanceOf: UnsafeMergeError,
    }
  );
});

test('incompatible-merge-force: should ignore incompatiblity and merge when forced', (t) => {
  // same as the above test with force
  const source = generateWorkflow('trigger-x');
  source.pushHistory(source.getVersionHash());
  const target = generateWorkflow('trigger-y');
  target.pushHistory(target.getVersionHash());

  t.false(source.canMergeInto(target));

  const sourceProject = new Project({ workflows: [source] });
  const targetProject = new Project({ workflows: [target] });
  t.notThrows(() =>
    Project.merge(sourceProject, targetProject, { force: true })
  );
});

test('diff: should return empty array for identical projects', (t) => {
  const wf = generateWorkflow('trigger-x');

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf],
  });

  const diffs = projectA.diff(projectB);

  t.is(diffs.length, 0);
});

test('diff: should detect changed workflow', (t) => {
  const wfA = generateWorkflow('trigger-x');
  const wfB = generateWorkflow('trigger-y');
  // Make sure they have the same id but different content
  wfB.id = wfA.id;

  const projectA = new Project({
    name: 'project-a',
    workflows: [wfA],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wfB],
  });

  const diffs = projectA.diff(projectB);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: wfA.id, type: 'changed' });
});

test('should detect added workflow', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const projectA = new Project({
    name: 'a',
    workflows: [wf1],
  });

  const projectB = new Project({
    name: 'b',
    workflows: [wf1, wf2],
  });

  const diffs = projectA.diff(projectB);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: wf2.id, type: 'added' });
});

test('diff: should detect removed workflow', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf1, wf2],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf1],
  });

  const diffs = projectA.diff(projectB);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: wf2.id, type: 'removed' });
});

test('diff: should detect multiple changes at once', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');
  const wf3 = generateWorkflow('@id c trigger-z');
  const wf4 = generateWorkflow('@id d trigger-w');

  // wf2 will be changed in projectB
  const wf2Changed = generateWorkflow('@id b trigger-different');

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf1, wf2, wf3], // has a, b, c
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf1, wf2Changed, wf4], // has a, b (changed), d (new)
  });

  const diffs = projectA.diff(projectB);

  t.is(diffs.length, 3);
  t.deepEqual(
    diffs.find((d) => d.id === 'b'),
    { id: 'b', type: 'changed' }
  );
  t.deepEqual(
    diffs.find((d) => d.id === 'c'),
    { id: 'c', type: 'removed' }
  );
  t.deepEqual(
    diffs.find((d) => d.id === 'd'),
    { id: 'd', type: 'added' }
  );
});

test('diff: should detect multiple workflows with same type of change', (t) => {
  const wf1 = generateWorkflow('@id a trigger-x');
  const wf2 = generateWorkflow('@id b trigger-y');
  const wf3 = generateWorkflow('@id c trigger-z');

  const wf1Changed = generateWorkflow('@id a trigger-X');
  const wf2Changed = generateWorkflow('@id b trigger-Y');

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf1, wf2, wf3],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf1Changed, wf2Changed, wf3],
  });

  const diffs = projectA.diff(projectB);

  t.is(diffs.length, 2);
  t.deepEqual(diffs[0], { id: 'a', type: 'changed' });
  t.deepEqual(diffs[1], { id: 'b', type: 'changed' });
});

test('diff: should detect change when workflow has same ID but different name', (t) => {
  const wf1 = generateWorkflow('@id my-workflow trigger-x');
  const wf2 = generateWorkflow('@id my-workflow trigger-y');

  // Ensure they have the same ID but different content
  wf1.name = 'Original Name';
  wf2.name = 'Different Name';

  const projectA = new Project({
    name: 'project-a',
    workflows: [wf1],
  });

  const projectB = new Project({
    name: 'project-b',
    workflows: [wf2],
  });

  const diffs = projectA.diff(projectB);

  t.is(diffs.length, 1);
  t.deepEqual(diffs[0], { id: 'my-workflow', type: 'changed' });
});
