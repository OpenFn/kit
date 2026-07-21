import test from 'ava';
import { print } from 'recast';
import parse from '../../src/parse';
import transform from '../../src/transform';
import visitors from '../../src/transforms/exports-only';

const enabled = { 'exports-only': true };
const disabled = { 'exports-only': false };

test('strips a non-exported value', (t) => {
  const before = `const x = 42;
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, '');
});

test('is a no-op if exports-only is false', (t) => {
  const before = `const x = 42;
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], disabled);
  const after = print(transformed).code;

  t.is(after, before);
});

test('is a no-op if no options are passed', (t) => {
  const before = `const x = 42;
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors]);
  const after = print(transformed).code;

  t.is(after, before);
});

test('strips operation calls', (t) => {
  const before = `get();
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, '');
});

test('strips export default []', (t) => {
  const before = `fn();
export default [];`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, '');
});

test('keeps import declarations', (t) => {
  const before = `import { get } from '@openfn/language-http';
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, `import { get } from '@openfn/language-http';`);
});

test('keeps named export declarations', (t) => {
  const before = `export const helper = 42;
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, `export const helper = 42;`);
});

test('keeps exported function declarations', (t) => {
  const before = `export function formatDate() {
  return 1;
}
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(
    after,
    `export function formatDate() {
  return 1;
}`
  );
});

test('drops non-exported declarations that no export depends on', (t) => {
  const before = `const unused = 42;
export function greet() {
  return 'hi';
}
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(
    after,
    `export function greet() {
  return 'hi';
}`
  );
});

test('keeps imports alongside named exports', (t) => {
  const before = `import { dateFns } from '@openfn/language-dhis2';
export const formatDate = 42;
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(
    after,
    `import { dateFns } from '@openfn/language-dhis2';
export const formatDate = 42;`
  );
});

test('keeps declarations referenced by an export list', (t) => {
  const before = `const x = 1;
export { x };
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(
    after,
    `const x = 1;
export { x };`
  );
});

test('keeps a function referenced by an aliased export list', (t) => {
  const before = `function formatDate() {
  return 1;
}
export { formatDate as format };
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(
    after,
    `function formatDate() {
  return 1;
}
export { formatDate as format };`
  );
});

test('keeps re-exports from another module', (t) => {
  const before = `export { helper } from './helpers';
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, `export { helper } from './helpers';`);
});

test('keeps export * from another module', (t) => {
  const before = `export * from './helpers';
fn();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, `export * from './helpers';`);
});

test('handles a file with only operations (no exports)', (t) => {
  const before = `fn();
get();`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, '');
});

test('handles an empty file', (t) => {
  const before = '';
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, '');
});

test('handles multiple exports without operations', (t) => {
  const before = `export const a = 42;
export const b = 42;
export function c() {
  return 1;
}`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], enabled);
  const after = print(transformed).code;

  t.is(after, before);
});

test('does not remove export default when exports-only is disabled', (t) => {
  const before = `fn();
export default [];`;
  const ast = parse(before);
  const transformed = transform(ast, [visitors], disabled);
  const after = print(transformed).code;

  t.is(after, before);
});
