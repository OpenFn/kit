import test from 'ava';
import { Project } from '../../src/Project';
import generateWorkflow, { generateProject } from '../../src/gen/generator';

import * as v2 from '../fixtures/sample-v2-project';

const proj = new Project({
  id: 'my-project',
  name: 'My Project',
  description: 'my lovely project',
  openfn: {
    uuid: '1234',
    endpoint: 'https://app.openfn.org',
  },
  options: {
    allow_support_access: false,
  },
  workflows: [generateWorkflow('a-b', { uuidSeed: 1, openfnUuid: true })],
});

test('should serialize to YAML format v2 project by default', (t) => {
  const yaml = proj.serialize('project');

  t.deepEqual(yaml, v2.yaml);
});

test('should explicitly serialize to YAML format', (t) => {
  const yaml = proj.serialize('project', { format: 'yaml' });

  t.deepEqual(yaml, v2.yaml);
});

// TODO come back and look at sorting - steps should be sorted by id,
// so workflow b-a should look exactly the same as this
// That should probably happen in workflow.toJSON
test('should serialize to JSON format v2 project', (t) => {
  const json = proj.serialize('project', { format: 'json' });

  t.deepEqual(json, v2.json);
});

// should load a project and serialize it back
