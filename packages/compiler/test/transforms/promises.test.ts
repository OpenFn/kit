import test from 'ava';
import { print } from 'recast';
import { NodePath, namedTypes as n } from 'ast-types';

import promises, {
  defer,
  rebuildPromiseChain,
} from '../../src/transforms/promises';
import parse from '../../src/parse';
import transform from '../../src/transform';

// throws if there's no defer declaration in the ast
export const assertDeferDeclaration = (ast: any) => {
  for (const node of ast.program.body) {
    if (n.FunctionDeclaration.check(node)) {
      if (node.id.name === 'defer') {
        return true;
      }
    }
  }

  throw new Error('No defer declaration found');
};

test("assertDeferDeclaration: find defer if it's the only thing", (t) => {
  // TODO maybe call it $defer
  const source = 'function defer () {}';

  const ast = parse(source);
  assertDeferDeclaration(ast);
  t.pass('defer found');
});

test('assertDeferDeclaration: throw if no defer found', (t) => {
  // this is not the right defer function syntax
  const source = 'const defer = () => {};';

  const ast = parse(source);
  try {
    assertDeferDeclaration(ast);
  } catch (e) {
    t.pass('assertion correctly failed');
  }
});

test('assertDeferDeclaration: find defer among several statements', (t) => {
  const source = `if(true) {};
  const d = () => {};
  function defer () {};
  const _defer = false`;

  const ast = parse(source);
  assertDeferDeclaration(ast);
  t.pass('defer found');
});

test('assertDeferDeclaration: throw if defer is not top level', (t) => {
  const source = `
  if (true) { function defer () {} }
  function x() { function defer () {} }
  fn(function defer () {})
  `;

  const ast = parse(source);
  try {
    assertDeferDeclaration(ast);
  } catch (e) {
    t.pass('assertion correctly failed');
  }
});

// Bunch of tests around the defer function

test('defer does not execute immediately', (t) => {
  let x = 0;

  const op = () => x++;

  defer(op);

  t.is(x, 0);
});

test('defer: function executes when called', async (t) => {
  let x = 0;

  const op = () => x++;

  const fn = defer(op);

  await fn({});

  t.is(x, 1);
});

test('defer: function executes an async function when called', async (t) => {
  const op = () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(22);
      }, 2);
    });

  const fn = defer(op);

  const result = await fn({});

  t.is(result, 22);
});

test('defer: returns a value', async (t) => {
  const op = (s) => s * s;

  const fn = defer(op);

  const result = await fn(5);

  t.is(result, 25);
});

test('defer: invoke the complete callback and pass state', async (t) => {
  const op = (s) => ++s;

  const fn = defer(op, (p) => p.then((s) => (s *= 2)));

  const result = await fn(2);

  t.is(result, 6);
});

test('defer: catch an error', async (t) => {
  const op = () => {
    throw 'lamine yamal';
  };

  const c = (_e: any) => {
    t.pass('caught the error');
  };

  const fn = defer(op, undefined, c);

  await fn(1);
});

test('defer: catch an async error', async (t) => {
  const op = () =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        // This should be handled gracefully
        reject('lamine yamal');

        // but this will be uncaught!
        // I don't think there's anything we can do about this tbh
        //throw 'lamine yamal';
      }, 2);
    });

  const c = (e: any) => {
    t.is(e, 'lamine yamal');
  };

  const fn = defer(op, undefined, c);

  await fn(1);
});

test('wrapFn: fn().then()', async (t) => {
  const source = `fn(x).then(() => {})`;
  const result = `defer(fn(x), p => p.then(() => {}))`;

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
  const result = `defer(fn(x), undefined, (e) => e)`;

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
  const result = `defer(fn(x), p => p.then((e) => e).then((e) => e))`;

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
  const result = `defer(fn(x), p => p.then((s) => s), (e) => e)`;

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
  const result = `defer(fn(x), p => p.then((s) => s).then(s => s), (e) => e)`;

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
  const result = `defer(fn(x), p => p.then((s) => s).catch(e => e), (e) => e)`;

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
  const result = `defer(fn(x), p => p.then(s => s));`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.Program;

  assertDeferDeclaration(transformed);

  const { code } = print(transformed);

  t.log(code);

  const { code: transformedExport } = print(transformed.program.body.at(-1));
  t.is(transformedExport, result);
});

test('transform: fn().catch()', (t) => {
  const source = `fn(x).catch(s => s);`;
  const result = `defer(fn(x), undefined, s => s);`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.Program;

  assertDeferDeclaration(transformed);

  const { code } = print(transformed);
  t.log(code);

  const { code: transformedExport } = print(transformed.program.body.at(-1));
  t.is(transformedExport, result);
});

test('transform: fn(get().then())', (t) => {
  const source = `fn(get(x).then(s => s));`;
  const result = `fn(defer(get(x), p => p.then(s => s)));`;

  const ast = parse(source);

  const transformed = transform(ast, [promises]) as n.Program;

  assertDeferDeclaration(transformed);

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

  const transformed = transform(ast, [promises]) as n.Program;

  const { code } = print(transformed);
  t.is(code, source);
});
