import test from 'ava';

import promises, { defer } from '../../src/transforms/promises';
import parse from '../../src/parse';
import transform from '../../src/transform';

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

  const fn = defer(op, (s) => (s *= 2));

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

// TODO what about the injected code?

// Maybe thjere are a couple of tests:
// - injects defer function
// - doesn't inject defer function if it doesn't need to
// And we just do a really basic AST check
// Or maybe even a regex checj

// Then we do a bunch of tests on the export array
// We just codeify that

// Let's assume that exports has already run
test('transform', (t) => {
  const source = `export default [fn(x).then(s => s)];`;
  const result = `export default [defer(fn(x), s => s)];`;

  const ast = parse(source);

  const transformed = transform(ast, [promises], {}) as n.Program;

  // assertDeferDeclaration(transformed)

  // TODO: extract the export array, then print it
  // Could I exclude the export array from the whole test?

  const { code } = print(transformed);

  t.is(code, result);
});
