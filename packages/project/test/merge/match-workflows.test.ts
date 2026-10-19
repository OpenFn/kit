import test from 'ava';
import Workflow from '../../src/Workflow';
import matchWorkflows from '../../src/merge/match-workflows';

const wf = (id: string, name?: string, uuid?: string) =>
  new Workflow({
    id,
    name,
    steps: [],
    ...(uuid && { openfn: { uuid } }),
  } as any);

test('match by id', (t) => {
  const result = matchWorkflows([wf('a'), wf('b')], [wf('b'), wf('c')]);
  t.deepEqual(result, { b: 'b' });
});

test('match by uuid when the ids differ (a rename)', (t) => {
  const result = matchWorkflows(
    [wf('new-id', 'Wf', 'uuid-1')],
    [wf('old-id', 'Wf', 'uuid-1')]
  );
  t.deepEqual(result, { 'new-id': 'old-id' });
});

test('match by name when there is no uuid and the ids differ', (t) => {
  const result = matchWorkflows(
    [wf('a', 'My Workflow')],
    [wf('b', 'My Workflow')]
  );
  t.deepEqual(result, { a: 'b' });
});

test('uuid beats id', (t) => {
  // each source shares an id with one target, and a uuid with the other
  const result = matchWorkflows(
    [wf('a', 'A', 'uuid-1'), wf('b', 'B', 'uuid-2')],
    [wf('a', 'A', 'uuid-2'), wf('b', 'B', 'uuid-1')]
  );
  t.deepEqual(result, { a: 'b', b: 'a' });
});

test('id beats name', (t) => {
  const result = matchWorkflows(
    [wf('a', 'Same'), wf('b', 'Other')],
    [wf('b', 'Same'), wf('c', 'Other')]
  );
  // a has the name of target b, but b is already claimed by id
  t.deepEqual(result, { b: 'b' });
});

test('ids match even if the uuids differ (eg, merging a sandbox)', (t) => {
  const result = matchWorkflows(
    [wf('a', 'A', 'uuid-1')],
    [wf('a', 'A', 'uuid-2')]
  );
  t.deepEqual(result, { a: 'a' });
});

test('matches are one-to-one', (t) => {
  // both sources want the same target
  const result = matchWorkflows(
    [wf('a', 'A', 'uuid-1'), wf('b', 'B', 'uuid-1')],
    [wf('x', 'X', 'uuid-1')]
  );
  t.deepEqual(result, { a: 'x' });
});

test('do not match by name if the name is not unique in the source', (t) => {
  const result = matchWorkflows(
    [wf('a', 'Same'), wf('b', 'Same')],
    [wf('x', 'Same')]
  );
  t.deepEqual(result, {});
});

test('do not match by name if the name is not unique in the target', (t) => {
  const result = matchWorkflows(
    [wf('a', 'Same')],
    [wf('x', 'Same'), wf('y', 'Same')]
  );
  t.deepEqual(result, {});
});

test('workflows with no name are never matched by name', (t) => {
  const result = matchWorkflows([wf('a')], [wf('b')]);
  t.deepEqual(result, {});
});
