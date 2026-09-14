import test from 'ava';
import parseCredentialsOption from '../../src/projects/parse-credentials-option';

test('none', (t) => {
  t.is(parseCredentialsOption('none'), 'none');
});

test('prune', (t) => {
  t.is(parseCredentialsOption('prune'), 'prune');
});

test('all', (t) => {
  t.is(parseCredentialsOption('all'), 'all');
});

test('a single credential name with no alias', (t) => {
  const result = parseCredentialsOption('a');
  t.deepEqual(result, { a: { name: 'a' } });
});

test('a comma separated list of credential names', (t) => {
  const result = parseCredentialsOption('a,b,c');
  t.deepEqual(result, {
    a: { name: 'a' },
    b: { name: 'b' },
    c: { name: 'c' },
  });
});

test('a credential mapped to a new name and owner', (t) => {
  const result = parseCredentialsOption('c=c:joe@openfn.org');
  t.deepEqual(result, {
    c: { name: 'c', owner: 'joe@openfn.org' },
  });
});

test('a mix of plain names and aliased names', (t) => {
  const result = parseCredentialsOption('a,b,c=c:joe@openfn.org');
  t.deepEqual(result, {
    a: { name: 'a' },
    b: { name: 'b' },
    c: { name: 'c', owner: 'joe@openfn.org' },
  });
});

test('an alias with a new name but no owner', (t) => {
  const result = parseCredentialsOption('a=renamed');
  t.deepEqual(result, {
    a: { name: 'renamed', owner: undefined },
  });
});
