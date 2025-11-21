import test from 'ava';
import getExports from '../src/get-exports';

test('exported variable', (t) => {
  const source = 'export const BigVal = 56;';
  const res = getExports(source);
  t.deepEqual(res, ['BigVal']);
});

test('exported function declaration', (t) => {
  const source = 'export function doSomething() {}';
  const res = getExports(source);
  t.deepEqual(res, ['doSomething']);
});

test('exported class', (t) => {
  const source = 'export class SomeClass {}';
  const res = getExports(source);
  t.deepEqual(res, ['SomeClass']);
});

test('exported multiple variables', (t) => {
  const source = 'export const a = 1, b = 2;';
  const res = getExports(source);
  t.deepEqual(res, ['a', 'b']);
});

test('named exports after declaration', (t) => {
  const source = `
    const a = 1, b = 2;
    export { a, b };
  `;
  const res = getExports(source);
  t.deepEqual(res, ['a', 'b']);
});

test('renamed exports', (t) => {
  const source = `
    const a = 1;
    export { a as alpha };
  `;
  const res = getExports(source);
  t.deepEqual(res, ['alpha']);
});

test('mixed export declarations', (t) => {
  const source = `
    export const x = 1;
    function y() {}
    export { y };
    const z = 3;
    export { z as zomething };
  `;
  const res = getExports(source);
  t.deepEqual(res, ['x', 'y', 'zomething']);
});

test('re-export from module', (t) => {
  const source = `export { lightning, runtime as compiler } from './openfn';`;
  const res = getExports(source);
  t.deepEqual(res, ['lightning', 'compiler']);
});

test('export default should be ignored', (t) => {
  const source = `
    export default function main() {}
    export const util = true;
  `;
  const res = getExports(source);
  t.deepEqual(res, ['util']);
});
