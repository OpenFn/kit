import test from 'ava';
import { mergeCollections } from '../../src/merge/merge-collections';

test('empty source and target returns empty array', (t) => {
  const result = mergeCollections([], []);
  t.deepEqual(result, []);
});

test('new local name with no remote match is created with a fresh id', (t) => {
  const result = mergeCollections(['my-collection'], []);

  t.is(result.length, 1);
  t.is(result[0].name, 'my-collection');
  t.truthy(result[0].id);
  t.falsy(result[0].delete);
});

test('matching name keeps the remote id', (t) => {
  const target = [{ id: 'remote-id-1', name: 'my-collection' }];
  const result = mergeCollections(['my-collection'], target);

  t.deepEqual(result, [{ id: 'remote-id-1', name: 'my-collection' }]);
});

test('name removed locally is flagged for deletion, keeping its remote id', (t) => {
  const target = [{ id: 'remote-id-1', name: 'my-collection' }];
  const result = mergeCollections([], target);

  t.deepEqual(result, [
    { id: 'remote-id-1', name: 'my-collection', delete: true },
  ]);
});

test('mix of keep, create and delete', (t) => {
  const target = [
    { id: 'remote-id-1', name: 'keep-me' },
    { id: 'remote-id-2', name: 'remove-me' },
  ];
  const result = mergeCollections(['keep-me', 'new-collection'], target);

  t.is(result.length, 3);

  const kept = result.find((c) => c.name === 'keep-me');
  t.deepEqual(kept, { id: 'remote-id-1', name: 'keep-me' });

  const created = result.find((c) => c.name === 'new-collection');
  t.truthy(created?.id);
  t.not(created?.id, 'remote-id-1');
  t.not(created?.id, 'remote-id-2');
  t.falsy(created?.delete);

  const removed = result.find((c) => c.name === 'remove-me');
  t.deepEqual(removed, {
    id: 'remote-id-2',
    name: 'remove-me',
    delete: true,
  });
});

test('renaming reads as delete + create (no rename tracking)', (t) => {
  const target = [{ id: 'remote-id-1', name: 'old-name' }];
  const result = mergeCollections(['new-name'], target);

  t.deepEqual(
    result.find((c) => c.name === 'old-name'),
    { id: 'remote-id-1', name: 'old-name', delete: true }
  );
  t.truthy(result.find((c) => c.name === 'new-name' && !c.delete));
});

test('does not mutate the target array', (t) => {
  const target = [{ id: 'remote-id-1', name: 'my-collection' }];
  mergeCollections([], target);

  t.deepEqual(target, [{ id: 'remote-id-1', name: 'my-collection' }]);
});
