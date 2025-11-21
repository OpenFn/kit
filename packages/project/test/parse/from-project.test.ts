import test from 'ava';
import state_v1 from '../fixtures/sample-v1-project';
import Project from '../../src/Project';

// Note that this will have no metadata stuff
// I suppose we could be smart and look for config.json?
// Just want a single fairly basic test here
//
test('import from a v1 state as JSON', async (t) => {
  const proj = await Project.from('project', state_v1, {});
});

test.todo('import from a v1 state as YAML');

// this is basically just new Project
test.todo('import from a v2 project as JSON');
test.todo('import from a v2 project as YAML');
