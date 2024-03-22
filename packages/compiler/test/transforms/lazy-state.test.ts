import test, { ExecutionContext } from 'ava';
import { print } from 'recast';
import { namedTypes, NodePath, builders as b } from 'ast-types';

import parse from '../../src/parse';

import transform from '../../src/transform';
import visitors from '../../src/transforms/lazy-state';

test('convert a simple dollar reference', (t) => {
  const ast = parse('get($.data)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)
  t.log(code)

  t.is(code, 'get(state => state.data)')
})

test('convert a chained dollar reference', (t) => {
  const ast = parse('get($.a.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)
  t.log(code)

  t.is(code, 'get(state => state.a.b.c.d)')
})

test('ignore a regular chain reference', (t) => {
  const ast = parse('get(a.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)
  t.log(code)

  t.is(code, 'get(a.b.c.d)')
})

test('ignore a string', (t) => {
  const ast = parse('get("$.a.b")');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)
  t.log(code)

  t.is(code, 'get("$.a.b")')
})

// TODO do we want to support this?
test('convert a nested dollar reference', (t) => {
  const ast = parse(`fn(() => {
  get($.data)
})`);

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)
  t.log(code)

  // syntax starts getting a but picky at this level,
  // better to do ast tests
  t.is(code, `fn(() => {
  get(state => state.data)
})`)
})

// TODO does our compiler not support optional chaining??
test.skip('convert an optional chained simple dollar reference', (t) => {
  const ast = parse('get($.a?.b.c.d)');

  // const transformed = transform(ast, [visitors]);
  // const { code } = print(transformed)
  // t.log(code)

  // t.is(code, 'get(state => state.a?.b.c.d)')
})