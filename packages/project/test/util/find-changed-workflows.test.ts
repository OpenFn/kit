import test from 'ava';
import findChangedWorkflows from '../../src/util/find-changed-workflows';
import { generateProject } from '../../src';
import { generateHash } from '../../src/util/version';

test('should return 0 changed workflows from forked_from', (t) => {
  const project = generateProject('proj', ['@id a a-b', '@id b x-y']);
  const [a, b] = project.workflows;

  // set up forked_from
  project.cli.forked_from = {
    [a.id]: generateHash(a),
    [b.id]: generateHash(b),
  };

  const changed = findChangedWorkflows(project);

  t.deepEqual(changed, []);
});

test('should return 1 changed workflows from forked_from', (t) => {
  const project = generateProject('proj', ['@id a a-b', '@id b x-y']);
  const [a, b] = project.workflows;

  // set up forked_from
  project.cli.forked_from = {
    [a.id]: generateHash(a),
    [b.id]: generateHash(b),
  };

  // Now change b
  b.steps[0].name = 'x1';

  const changed = findChangedWorkflows(project);
  t.is(changed.length, 1);
  t.is(changed[0].id, 'b');
});

test('should return 1 removed workflow', (t) => {
  const project = generateProject('proj', ['@id a a-b', '@id b x-y']);
  const [a, b] = project.workflows;

  project.cli.forked_from = {
    [a.id]: generateHash(a),
    [b.id]: generateHash(b),
  };

  // remove workflow b
  project.workflows.pop()

  const changed = findChangedWorkflows(project);
  t.is(changed.length, 1);
  t.is(changed[0].id, 'b');
});

test('should return 1 added workflow', (t) => {
  const project = generateProject('proj', ['@id a a-b', '@id b x-y']);
  const [a, b] = project.workflows;

  project.cli.forked_from = {
    [a.id]: generateHash(a),
    // Do not include b in forked_from - it's new!
  };

  const changed = findChangedWorkflows(project);
  t.is(changed.length, 1);
  t.is(changed[0].id, 'b');
});

test.todo('changed from history');
test.todo('multiple changed workflows');
test.todo('if no base available, assume a change');
