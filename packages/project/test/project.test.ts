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
  workflows: {
    wf1: {
      id: '72ca3eb0-042c-47a0-a2a1-a545ed4a8406',
      name: 'wf1',
      edges: {
        'webhook->transform-data': {
          enabled: true,
          id: 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
          source_trigger_id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          condition_type: 'always',
          target_job_id: '66add020-e6eb-4eec-836b-20008afca816',
        },
      },
      concurrency: null,
      inserted_at: '2025-04-23T11:19:32Z',
      updated_at: '2025-04-23T11:19:32Z',
      jobs: {
        'transform-data': {
          id: '66add020-e6eb-4eec-836b-20008afca816',
          name: 'Transform data',
          body: 'fn(s => s)',
          adaptor: '@openfn/language-common@latest',
          project_credential_id: null,
          keychain_credential_id: null,
        },
      },
      triggers: {
        webhook: {
          enabled: true, // TODO enabled: false is a bit interesting
          id: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
          type: 'webhook',
        },
      },
      lock_version: 1,
      deleted_at: null,
    },
  },
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

test('should support credentials', (t) => {
  const project = new Project({
    credentials: [
      {
        uuid: '21345',
        name: 'My Credential',
        owner: 'admin@openfn.org',
      },
    ],
  });

  const [cred] = project.credentials;
  t.deepEqual(cred, {
    uuid: '21345',
    name: 'My Credential',
    owner: 'admin@openfn.org',
  });
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
        webhook: '4a06289c-15aa-4662-8dc6-f0aaacd8a058',
        'webhook-transform-data': 'a9a3adef-b394-4405-814d-3ac4323f4b4b',
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
