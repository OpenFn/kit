import test from 'ava'
import { isPath } from '../../src/util';

// Code snippets
[
  'const x = 10',
  `fn();
  export default [fn];`,
  'export default "script.js";',
  '// or any other .js file',
  // '// or any other .js', // tricky one! Will break us at the moment
  `x;
x.js`,
].forEach((src) => {
  test(`is not a path: ${src}`, (t) => {
    t.falsy(isPath(src));
  })
});

// Paths
[
  'script.js',
  'my script.js',
  '../my script.js',
  'path/to/script.js',
  '/path/to/script.js',
  '/path/to/script.ojs', // openfn js
  '/path/to/script.ts',
].forEach((src) => {
  test(`is a path: ${src}`, (t) => {
    t.truthy(isPath(src));
  })
});