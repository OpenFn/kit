import * as l from '@openfn/lexicon';
import test from 'ava';
import { Project } from '../../src/Project';
import generateWorkflow, { generateProject } from '../../src/gen/generator';

import * as v2 from '../fixtures/sample-v2-project';

const createProject = (props: Partial<l.Project> = {}) => {
  const proj = new Project({
    id: 'my-project',
    name: 'My Project',
    description: 'my lovely project',
    sandbox: { parentId: 'abcd' },
    cli: {
      alias: 'main',
    },
    openfn: {
      uuid: '1234',
      endpoint: 'https://app.openfn.org',
    },
    options: {
      allow_support_access: false,
      env: 'dev',
      color: 'red',
    },
    credentials: [
      {
        uuid: 'x',
        owner: 'admin@openfn.org',
        name: 'My Credential',
      },
    ],
    workflows: [
      generateWorkflow(
        'trigger(type=webhook)-b(expression="fn()",adaptor=common,project_credential_id=x)',
        {
          uuidSeed: 1,
          openfnUuid: true,
        }
      ),
    ],
    ...props,
  });
  // hack
  delete proj.workflows[0].steps[0].name;
  proj.workflows[0].start = 'trigger';

  // add some history
  proj.workflows[0].workflow.history = ['a', 'b'];
  return proj;
};

test('should serialize to YAML format v2 project by default', (t) => {
  const proj = createProject();
  const yaml = proj.serialize('project');

  t.deepEqual(yaml, v2.yaml);
});

test('should explicitly serialize to YAML format', (t) => {
  const proj = createProject();
  const yaml = proj.serialize('project', { format: 'yaml' });

  t.deepEqual(yaml, v2.yaml);
});

// TODO come back and look at sorting - steps should be sorted by id,
// so workflow b-a should look exactly the same as this
// That should probably happen in workflow.toJSON
test('should serialize to JSON format v2 project', (t) => {
  const proj = createProject();
  const json = proj.serialize('project', { format: 'json' });
  t.deepEqual(json, v2.json);
});

// should load a project and serialize it back

test('should exclude null values in yaml', (t) => {
  const proj = createProject({
    options: {
      concurrency: null,
      allow_support_access: false,
      env: 'dev',
      color: 'red',
    },
  });

  // force some null values into the workflow structure
  proj.workflows[0].steps[1].openfn.keychain_credential_id = null;

  const yaml = proj.serialize('project', { format: 'yaml' });
  t.deepEqual(yaml, v2.yaml);
});

test('should include sandboxy metadata', (t) => {
  const proj = createProject({});

  const json = proj.serialize('project', { format: 'json' });

  t.is(json.sandbox.parentId, 'abcd');
  t.is(json.options.env, 'dev');
  t.is(json.options.color, 'red');
});
