import baseMerge from '../../src/util/base-merge';
import test from 'ava';

test('full merge', (t) => {
  const target = { key: 'one', title: 'target' };
  const source = { key: 'two', title: 'source' };
  const result = baseMerge(target, source);

  t.deepEqual(result, { key: 'two', title: 'source' });
});

test('full merge: existing target props', (t) => {
  const target = { key: 'one', title: 'target', openfn: { uuid: '<uuid>' } };
  const source = { key: 'two', title: 'source' };
  const result = baseMerge(target, source);

  t.deepEqual(result, {
    key: 'two',
    title: 'source',
    openfn: { uuid: '<uuid>' },
  });
});

test('full merge: additional source keys', (t) => {
  const target = { key: 'one', title: 'target' };
  const source = { key: 'two', title: 'source', props: { isNew: true } };
  const result = baseMerge(target, source);

  t.deepEqual(result, {
    key: 'two',
    title: 'source',
    props: { isNew: true },
  });
});

test('full merge: existing target props & additional source keys', (t) => {
  const target = { key: 'one', title: 'target', openfn: { uuid: '<uuid>' } };
  const source = { key: 'two', title: 'source', props: { isNew: true } };
  const result = baseMerge(target, source);

  t.deepEqual(result, {
    key: 'two',
    title: 'source',
    openfn: { uuid: '<uuid>' },
    props: { isNew: true },
  });
});

test('partial merge', (t) => {
  const target = { key: 'one', title: 'target' };
  const source = { key: 'two', title: 'source' };
  const result = baseMerge(target, source, ['key']);

  t.deepEqual(result, {
    key: 'two',
    title: 'target',
  });
});

test('partial merge: existing target props', (t) => {
  const target = { key: 'one', title: 'target', openfn: { uuid: '<uuid>' } };
  const source = { key: 'two', title: 'source' };
  const result = baseMerge(target, source, ['key']);

  t.deepEqual(result, {
    key: 'two',
    title: 'target',
    openfn: { uuid: '<uuid>' },
  });
});

test('partial merge: additional source keys', (t) => {
  const target = { key: 'one', title: 'target' };
  const source = { key: 'two', title: 'source', props: { isNew: true } };
  const result = baseMerge(target, source, ['key', 'props']);

  t.deepEqual(result, {
    key: 'two',
    title: 'target',
    props: { isNew: true },
  });
});

test('partial merge: existing target props & additional source keys', (t) => {
  const target = { key: 'one', title: 'target', openfn: { uuid: '<uuid>' } };
  const source = { key: 'two', title: 'source', props: { isNew: true } };
  const result = baseMerge(target, source, ['key', 'props']);

  t.deepEqual(result, {
    key: 'two',
    title: 'target',
    openfn: { uuid: '<uuid>' },
    props: { isNew: true },
  });
});

test('assign', (t) => {
  const target = { key: 'one', title: 'target', openfn: { uuid: '<uuid>' } };
  const source = { key: 'two', title: 'source', props: { isNew: true } };
  const result = baseMerge(target, source, ['key', 'props'], {
    something: 'an assign prop',
  });

  t.deepEqual(result, {
    key: 'two',
    title: 'target',
    openfn: { uuid: '<uuid>' },
    something: 'an assign prop',
    props: { isNew: true },
  });
});

test('special: arrays are shallow merged', (t) => {
  const target = { key: 'one', title: 'target', colours: ['red', 'blue', 'green'] };
  const source = { key: 'two', title: 'source', colours: ['green', 'yellow'] };
  const result = baseMerge(target, source, ['key', 'props', 'colours']);

  t.deepEqual(result, {
    key: 'two',
    title: 'target',
    colours: ['green', 'yellow'],
  });
});

// TODO: should a merge create a union of two objects?
test('special: objects are shallow merged', (t) => {
  const target = {
    key: 'one',
    title: 'target',
    opts: { colour: 'green', isNew: true },
  };
  const source = {
    key: 'two',
    title: 'source',
    opts: { isDeleted: true, time: 'yesterday' },
  };
  const result = baseMerge(target, source, ['key', 'props', 'opts']);

  t.deepEqual(result, {
    key: 'two',
    title: 'target',
    opts: {
      isDeleted: true,
      time: 'yesterday',
    },
  });
});
