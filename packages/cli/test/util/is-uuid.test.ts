import test from 'ava';
import isUuid from '../../src/util/is-uuid';

test('accepts a uuid, in either case', (t) => {
  t.true(isUuid('a1b2c3d4-0000-4000-8000-000000000001'));
  t.true(isUuid('A1B2C3D4-0000-4000-8000-000000000001'));
});

test('rejects aliases, partial uuids and empty values', (t) => {
  t.false(isUuid('staging'));
  t.false(isUuid('a1b2c3d4-0000-4000-8000'));
  t.false(isUuid(' a1b2c3d4-0000-4000-8000-000000000001'));
  t.false(isUuid(''));
  t.false(isUuid(undefined));
  t.false(isUuid(null));
});
