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

  t.is(code, 'get(state => state.data)')
})

test('convert a chained dollar reference', (t) => {
  const ast = parse('get($.a.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)

  t.is(code, 'get(state => state.a.b.c.d)')
})

test('ignore a regular chain reference', (t) => {
  const ast = parse('get(a.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)

  t.is(code, 'get(a.b.c.d)')
})

test('ignore a string', (t) => {
  const ast = parse('get("$.a.b")');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)

  t.is(code, 'get("$.a.b")')
})

// TODO do we want to support this?
test('convert a nested dollar reference', (t) => {
  const ast = parse(`fn(() => {
  get($.data)
})`);

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)

  // syntax starts getting a but picky at this level,
  // better to do ast tests
  t.is(code, `fn(() => {
  get(state => state.data)
})`)
})

test('do not convert a $ var (param)', (t) => {
  const src = `fn(($) => {
    return $.a.b;
  })`
  const ast = parse(src);

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)

  t.is(code, src)
})

test('do not convert a $ var (const)', (t) => {
  const src = `fn((s) => {
    const $ = 10;
    s.data = $.a.b
    return s;
  })`
  const ast = parse(src);

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)

  t.is(code, src)
})

test('convert an optional chained simple dollar reference', (t) => {
  const ast = parse('get($.a?.b.c.d)');

  const transformed = transform(ast, [visitors]);
  const { code } = print(transformed)

  t.is(code, 'get(state => state.a?.b.c.d)')
})