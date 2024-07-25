import test from 'ava';
import { print } from 'recast';
import { NodePath, namedTypes as n } from 'ast-types';

import promises, {
  assertDeferDeclaration,
  rebuildPromiseChain,
} from '../../src/transforms/promises';
import parse from '../../src/parse';
import transform from '../../src/transform';

test("assertDeferDeclaration: find defer if it's the only thing", (t) => {
  const source = 'import { defer } from "@openfn/runtime"';

  const ast = parse(source);
  assertDeferDeclaration(ast.program);
  t.pass('defer found');
});

test('assertDeferDeclaration: throw if no defer import found', (t) => {
  const source = 'import { defer } from "@openfn/common"';

  const ast = parse(source);
  try {
    assertDeferDeclaration(ast.program);
  } catch (e) {
    t.pass('assertion correctly failed');
  }
});

test('assertDeferDeclaration: find defer among several statements', (t) => {
  const source = `if(true) {};
  const d = () => {};
  import { defer } from "@openfn/runtime";
  function $defer () {};
  const _defer = false`;

  const ast = parse(source);
  assertDeferDeclaration(ast.program);
  t.pass('defer found');
});

test('wrapFn: fn().then()', async (t) => {
  const source = `fn(x).then(() => {})`;
  const result = `_defer(fn(x), p => p.then(() => {}))`;

  const ast = parse(source);
  const nodepath = new NodePath(ast.program);
  const transformed = rebuildPromiseChain(
    nodepath.get('body', 0, 'expression')
  );

  const { code } = print(transformed);

  t.log(code);
  t.is(code, result);
});

test('wrapFn: fn.catch()', async (t) => {
  const source = `fn(x).catch((e) => e)`;
  const result = `_defer(fn(x), undefined, (e) => e)`;

  const ast = parse(source);
  const nodepath = new NodePath(ast.program);
  const transformed = rebuildPromiseChain(
    nodepath.get('body', 0, 'expression')
  );

  const { code } = print(transformed);

  t.log(code);
  t.is(code, result);
});

test('wrapFn: fn.then().then()', async (t) => {
  const source = `fn(x).then((e) => e).then((e) => e)`;
  const result = `_defer(fn(x), p => p.then((e) => e).then((e) => e))`;

  const ast = parse(source);
  const nodepath = new NodePath(ast.program);
  const transformed = rebuildPromiseChain(
    nodepath.get('body', 0, 'expression')
  );

  const { code } = print(transformed);

  t.log(code);
  t.is(code, result);
});

test('wrapFn: fn.catch().then()', async (t) => {
  const source = `fn(x).catch((e) => e).then((s) => s)`;
  const result = `_defer(fn(x), p => p.then((s) => s), (e) => e)`;

  const ast = parse(source);
  const nodepath = new NodePath(ast.program);
  const transformed = rebuildPromiseChain(
    nodepath.get('body', 0, 'expression')
  );

  const { code } = print(transformed);

  t.log(code);
  t.is(code, result);
});

test('wrapFn: fn.catch().then().then()', async (t) => {
  const source = `fn(x).catch((e) => e).then((s) => s).then(s => s)`;
  const result = `_defer(fn(x), p => p.then((s) => s).then(s => s), (e) => e)`;

  const ast = parse(source);
  const nodepath = new NodePath(ast.program);
  const transformed = rebuildPromiseChain(
    nodepath.get('body', 0, 'expression')
  );

  const { code } = print(transformed);

  t.log(code);
  t.is(code, result);
});

test('wrapFn: fn.catch().then().catch', async (t) => {
  const source = `fn(x).catch((e) => e).then((s) => s).catch(e => e)`;
  const result = `_defer(fn(x), p => p.then((s) => s).catch(e => e), (e) => e)`;

  const ast = parse(source);
  const nodepath = new NodePath(ast.program);
  const transformed = rebuildPromiseChain(
    nodepath.get('body', 0, 'expression')
  );

  const { code } = print(transformed);

  t.log(code);
  t.is(code, result);
});

test('transform: fn().then()', (t) => {
  const source = `fn(x).then(s => s);`;
  const result = `_defer(fn(x), p => p.then(s => s));`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.File;

  assertDeferDeclaration(transformed.program);

  const { code } = print(transformed);

  t.log(code);

  const { code: transformedExport } = print(transformed.program.body.at(-1));
  t.is(transformedExport, result);
});

test('transform: fn().catch()', (t) => {
  const source = `fn(x).catch(s => s);`;
  const result = `_defer(fn(x), undefined, s => s);`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.File;

  assertDeferDeclaration(transformed.program);

  const { code } = print(transformed);
  t.log(code);

  const { code: transformedExport } = print(transformed.program.body.at(-1));
  t.is(transformedExport, result);
});

test('transform: only import once ', (t) => {
  const source = `fn(x).then(s => s);
fn(x).then(s => s);`;

  const result = `import { defer as _defer } from "@openfn/runtime";
_defer(fn(x), p => p.then(s => s));
_defer(fn(x), p => p.then(s => s));`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.File;
  const { code } = print(transformed);
  t.is(code, result);
});

test('transform: insert new import at the end of existing imports ', (t) => {
  const source = `import x from 'y';
fn(x).then(s => s);`;

  const result = `import x from 'y';
import { defer as _defer } from "@openfn/runtime";
_defer(fn(x), p => p.then(s => s));`;

  const ast = parse(source);
  const transformed = transform(ast, [promises]) as n.File;
  const { code } = print(transformed);

  t.is(code, result);
});

test('transform: fn(get().then())', (t) => {
  const source = `fn(get(x).then(s => s));`;
  const result = `fn(_defer(get(x), p => p.then(s => s)));`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.File;

  assertDeferDeclaration(transformed.program);

  const { code } = print(transformed);

  t.log(code);

  const { code: transformedExport } = print(transformed.program.body.at(-1));
  t.is(transformedExport, result);
});

test('transform: fn(get().then(), get().then())', (t) => {
  const source = `fn(get(x).then(s => s), post(x).then(s => s));`;
  const result = `fn(_defer(get(x), p => p.then(s => s)), _defer(post(x), p => p.then(s => s)));`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.File;

  assertDeferDeclaration(transformed.program);

  const { code } = print(transformed);

  t.log(code);

  const { code: transformedExport } = print(transformed.program.body.at(-1));
  t.is(transformedExport, result);
});

test('transform: ignore promises in a callback', (t) => {
  const source = `fn((state) => {
    return get().then((s) => s)
});`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.File;

  const { code } = print(transformed);
  t.is(code, source);
});
