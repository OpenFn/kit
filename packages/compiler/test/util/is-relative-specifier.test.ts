import test from 'ava';
import { isRelativeSpecifier } from '../../src/util';

// Relative specifiers
[
  './my-module',
  './my/module',
  '/my/module',
  '/module',
  '~/module',
  '.',
  '..',
  'C:\\repo\\module', // windows absolute path
].forEach((path) => {
  test(`is a relative specifier: ${path}`, (t) => {
    t.truthy(isRelativeSpecifier(path));
  });
});

// non relative specififiers
[
  'module',
  'module/submodule',
  'namespace@module',
  'module@^3.2.1',
  '@namespace@module@=3.2.1',
  'ab:\\repo\\module', // looks like a windows path, but is not!
].forEach((path) => {
  test(`is an absolute specifier: ${path}`, (t) => {
    t.falsy(isRelativeSpecifier(path));
  });
});
