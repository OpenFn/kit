// should parse a project from app state and back again
import test from 'ava';
import type { Provisioner } from '@openfn/lexicon/lightning';
import { Project } from '../src/Project';
import generateWorkflow, { generateProject } from '../src/gen/generator';

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
          body: '// Check out the Job Writing Guide for help getting started:\n// https://docs.openfn.org/documentation/jobs/job-writing-guide\n',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
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

test('should generate a correct identifier with default values', (t) => {
  const project = new Project({}, {});

  const id = project.getIdentifier();
  t.is(id, 'main@local');
});

test('should generate a correct identifier with real values', (t) => {
  const project = new Project({
    openfn: {
      env: 'staging',
      endpoint: 'https://app.openfn.org',
    },
  });

  const id = project.getIdentifier();
  t.is(id, 'staging@app.openfn.org');
});

test('should generate a correct identifier with weird values', (t) => {
  const project = new Project({
    openfn: {
      env: 'hello',
      endpoint: 'https://app.com/openfn',
    },
  });

  const id = project.getIdentifier();
  t.is(id, 'hello@app.com');
});

test('should convert a state file to a project and back again', (t) => {
  const config = {
    endpoint: 'app.openfn.org',
    env: 'test',
    formats: 'json',
  };

  const project = Project.from('state', state, config);
  t.is(project.openfn.env, 'test');
  t.is(project.openfn.endpoint, 'app.openfn.org');
  t.is(project.openfn.uuid, state.id);
  t.is(project.name, state.name);

  // TODO: this hack is needed right now to serialize the state as json
  project.config.formats.project = 'json';

  const newState = project.serialize('state');
  t.deepEqual(newState, state);
});

test.todo('serialize to and from yaml');

test.todo('serialize state as json');
test.todo('serialize state as yaml');

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

test('should return UUIDs for everything', (t) => {
  const project = Project.from('state', state, {});
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
      message: `The below workflows can't be merged directly without losing data\nWorkflow → Workflow\nPass --force to force the merge anyway`,
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
