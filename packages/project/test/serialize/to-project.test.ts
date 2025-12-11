import test from 'ava';
import { Project } from '../../src/Project';
import generateWorkflow, { generateProject } from '../../src/gen/generator';

import * as v2 from '../fixtures/sample-v2-project';

const createProject = () => {
  const proj = new Project({
    id: 'my-project',
    name: 'My Project',
    description: 'my lovely project',
    cli: {
      alias: 'main',
    },
    openfn: {
      uuid: '1234',
      endpoint: 'https://app.openfn.org',
    },
    options: {
      allow_support_access: false,
    },
    workflows: [
      generateWorkflow(
        'trigger(type=webhook)-b(expression="fn()",adaptor=common,project_credential_id=x)',
        {
          uuidSeed: 1,
          openfnUuid: true,
        }
      ),
    ],
  });
  // hack
  delete proj.workflows[0].steps[0].name;
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
  const proj = createProject();

  // force some null values into the workflow structure
  proj.workflows[0].openfn.concurrency = null;
  proj.workflows[0].steps[1].openfn.keychain_credential_id = null;

  const yaml = proj.serialize('project', { format: 'yaml' });
  t.deepEqual(yaml, v2.yaml);
});
