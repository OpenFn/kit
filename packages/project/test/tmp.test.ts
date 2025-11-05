import test from 'ava';
import Project from '../src';

const main_json = {
  name: 'main',
  id: 'f30c0cc1-a8d6-439c-9182-bd3c4d0fe9fb',
  project_credentials: [],
  workflows: [
    {
      id: 1000,
      jobs: [
        {
          name: 'x',
          adaptor: 'a',
          id: 1001,
        },
      ],
      triggers: [],
      edges: [],
      name: 'Workflow',
    },
  ],
};

const staging_json = {
  name: 'staging',
  id: 'abdba4db-f058-43b0-9f3f-7a8f18976d86',
  project_credentials: [],
  workflows: [
    {
      id: 2000,
      jobs: [
        {
          name: 'x',
          adaptor: 'b',
          id: 2001,
        },
      ],
      triggers: [],
      edges: [],
      name: 'Workflow',
    },
  ],
};

test('should merge the fucking thing correctly', (t) => {
  const main = Project.from('state', main_json);
  const staging = Project.from('state', staging_json);

  const result = Project.merge(staging, main);

  const step = result.workflows[0].steps[0];
  t.is(step.name, 'x');
  t.is(step.adaptor, 'b'); // new!
  t.is(step.openfn.uuid, 1001);
});
