import test from 'ava';
import { print } from 'recast';
import parse from '../../src/parse';
import transform from '../../src/transform';
import visitors, { hasExportableCode } from '../../src/transforms/exports-only';

const compile = (source: string, options = {}) =>
  print(transform(parse(source), [visitors], options)).code.trim();

// --- hasExportableCode ---

test('hasExportableCode: true for export const', (t) => {
  t.true(hasExportableCode('export const x = 1;'));
});

test('hasExportableCode: true for export function', (t) => {
  t.true(hasExportableCode('export function foo() {}'));
});

test('hasExportableCode: true for export let', (t) => {
  t.true(hasExportableCode('export let x = 1;'));
});

test('hasExportableCode: true for export var', (t) => {
  t.true(hasExportableCode('export var x = 1;'));
});

test('hasExportableCode: true for export class', (t) => {
  t.true(hasExportableCode('export class Foo {}'));
});

test('hasExportableCode: false for import only', (t) => {
  t.false(hasExportableCode("import { get } from '@openfn/language-http';"));
});

test('hasExportableCode: false for empty string', (t) => {
  t.false(hasExportableCode(''));
});

test('hasExportableCode: false for operations only', (t) => {
  t.false(hasExportableCode('fn();\nget();'));
});

test('is a no-op when options is not true', (t) => {
  const before = `fn();
export default [];`;
  t.is(compile(before), before);
});

test('is a no-op when options is false', (t) => {
  const before = `fn();`;
  t.is(compile(before, { 'exports-only': false }), before);
});

test('strips operation calls', (t) => {
  const before = `get();
fn();`;
  t.is(compile(before, { 'exports-only': true }), '');
});

test('strips export default []', (t) => {
  const before = `fn();
export default [];`;
  t.is(compile(before, { 'exports-only': true }), '');
});

test('strips non-exported declarations', (t) => {
  const before = `const x = 42;
fn();`;
  t.is(compile(before, { 'exports-only': true }), '');
});

test('keeps import declarations', (t) => {
  const before = `import { get } from '@openfn/language-http';
fn();`;
  const after = `import { get } from '@openfn/language-http';`;
  t.is(compile(before, { 'exports-only': true }), after);
});

test('keeps named export declarations', (t) => {
  const before = `export const helper = 42;
fn();`;
  const after = `export const helper = 42;`;
  t.is(compile(before, { 'exports-only': true }), after);
});

test('keeps exported function declarations', (t) => {
  const before = `export function formatDate() {
  return 1;
}
fn();`;
  const after = `export function formatDate() {
  return 1;
}`;
  t.is(compile(before, { 'exports-only': true }), after);
});

test('drops non-exported declarations that no export depends on', (t) => {
  const before = `const unused = 42;
export function greet() {
  return 'hi';
}
fn();`;
  const after = `export function greet() {
  return 'hi';
}`;
  t.is(compile(before, { 'exports-only': true }), after);
});

test('keeps imports alongside named exports', (t) => {
  const before = `import { dateFns } from '@openfn/language-dhis2';
export const formatDate = 42;
fn();`;
  const after = `import { dateFns } from '@openfn/language-dhis2';
export const formatDate = 42;`;
  t.is(compile(before, { 'exports-only': true }), after);
});

test('handles a file with only operations (no exports)', (t) => {
  const before = `fn();
get();`;
  t.is(compile(before, { 'exports-only': true }), '');
});

test('handles an empty file', (t) => {
  t.is(compile('', { 'exports-only': true }), '');
});

test('handles multiple exports without operations', (t) => {
  const source = `export const a = 42;
export const b = 42;
export function c() {
  return 1;
}`;
  t.is(compile(source, { 'exports-only': true }), source);
});

test('does not remove export default when exports-only is disabled', (t) => {
  const before = `fn();
export default [];`;
  t.is(compile(before, { 'exports-only': false }), before);
});
