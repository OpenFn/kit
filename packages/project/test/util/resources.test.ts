import test from 'ava';
import { Project } from '../../src/Project';
import { jsonToYaml, yamlToJson } from '../../src/util/yaml';
import {
  fromResourceCollections,
  toResourceCollections,
  updateResourceCollections,
} from '../../src/util/resources';

test('toResourceCollections: keyed by name, with no uuids', (t) => {
  t.deepEqual(
    toResourceCollections([{ uuid: 'a', name: 'one' }, { name: 'two' }]),
    { one: {}, two: {} }
  );
});

test('fromResourceCollections: reads a map keyed by name', (t) => {
  t.deepEqual(fromResourceCollections({ one: {}, two: {} }), [
    { name: 'one' },
    { name: 'two' },
  ]);
});

test('fromResourceCollections: also reads a plain list of names', (t) => {
  t.deepEqual(fromResourceCollections(['one', 'two']), [
    { name: 'one' },
    { name: 'two' },
  ]);
});

test('fromResourceCollections: an empty or null key means no collections', (t) => {
  t.deepEqual(fromResourceCollections({}), []);
  t.deepEqual(fromResourceCollections(null), []);
});

test('updateResourceCollections: replaces collections and leaves other keys alone', (t) => {
  const project = new Project({ name: 'p', collections: [{ name: 'new' }] });
  const existing = jsonToYaml({
    channels: { c: { name: 'c', destination_url: 'https://x.org' } },
    collections: { old: {} },
  });

  const result = yamlToJson(updateResourceCollections(project, existing)!);

  t.deepEqual(result, {
    channels: { c: { name: 'c', destination_url: 'https://x.org' } },
    collections: { new: {} },
  });
});

test('updateResourceCollections: creates the content if there is no existing file', (t) => {
  const project = new Project({ name: 'p', collections: [{ name: 'one' }] });

  t.deepEqual(yamlToJson(updateResourceCollections(project)!), {
    collections: { one: {} },
  });
});

test('updateResourceCollections: leaves the file alone if collections are not managed', (t) => {
  const project = new Project({ name: 'p' });
  const existing = jsonToYaml({ channels: {} });

  t.is(updateResourceCollections(project, existing), existing);
  t.is(updateResourceCollections(project), undefined);
});
