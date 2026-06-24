import test from 'ava';
import { b, mb } from '../../src/util/memory';

test('mb converts bytes to megabytes', (t) => {
  t.is(mb(1024 * 1024), 1);
  t.is(mb(512 * 1024 * 1024), 512);
});

test('b converts megabytes to bytes', (t) => {
  t.is(b(1), 1024 * 1024);
  t.is(b(512), 512 * 1024 * 1024);
});

test('b and mb are inverses', (t) => {
  t.is(mb(b(256)), 256);
  t.is(b(mb(256 * 1024 * 1024)), 256 * 1024 * 1024);
});
