import test, { ExecutionContext } from 'ava';
import { namedTypes, NodePath, builders as b } from 'ast-types';
import { print } from 'recast';
import parse from '../../src/parse';

import transform from '../../src/transform';
import visitors from '../../src/transforms/ensure-exports';

// TODO where can I get this info?
// Representations of ast nodes is a bit of a mess tbh
type RecastNode = typeof NodePath & {
  tokens: Array<{
    type: string;
    value: string;
  }>
}

// https://github.com/estree/estree/blob/master/es2015.md#exports

const findKeyword = (ast: RecastNode, kind: string) => ast.tokens.find(
  ({ type, value }) => type === "Keyword" && value === kind
);

const assertCodeEqual = (t: ExecutionContext, a: namedTypes.Node, b: namedTypes.Node) => {
  t.assert(print(a).code === print(b).code);
}

test('visits a Program node', (t) => {
  let visitCount = 0;
  const mockVisitors = [{
    types: visitors.types,
    visitor: () => { visitCount++; }
  }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(
        b.identifier('jam'),
        []
      )
    )
  ]);

  transform(program, mockVisitors);
  t.assert(visitCount === 1)
});

test('add exports to empty source', (t) => {
  const ast = parse('')

  const transformed = transform(ast, [visitors]);

  // last node should be a top level export
  const last = transformed.program.body.at(-1);
  t.assert(last.type === 'ExportDefaultDeclaration');
});

// The point here is that anything apart from operations will be ignored
test('add empty exports to source with only variable declarations', (t) => {
  const ast = parse('const x  = 10;')
  
  const transformed = transform(ast, [visitors]);

  const last = transformed.program.body.at(-1);
  t.assert(last.type === 'ExportDefaultDeclaration');
});

test('add empty exports to source with a single function call', (t) => {
  const ast = parse('fn();')
  
  const transformed = transform(ast, [visitors]);

  const last = transformed.program.body.at(-1);
  t.assert(last.type === 'ExportDefaultDeclaration');
});

test('add empty exports to source without multiple statements', (t) => {
  const ast = parse(`
const x  = 10;
const fn  =  () => 2;
fn();`);
  
  const transformed = transform(ast, [visitors]);

  const last = transformed.program.body.at(-1);
  t.assert(last.type === 'ExportDefaultDeclaration');
});

test('don\'t change source with a default export', (t) => {
  const ast = parse('export default [];')
  
  // There are many kinds of export nodes so as a short hand, let's just check for export keywords
  
  const e = findKeyword(ast, 'export');
  t.truthy(e);

  const transformed = transform(ast, [visitors]);
  assertCodeEqual(t, ast, transformed);
});

test('don\'t change source with a named export', (t) => {
  const ast = parse('const x = 10; export { x };')

  const transformed = transform(ast, [visitors]);
  assertCodeEqual(t, ast, transformed);
});

test('don\'t change source with a named export const ', (t) => {
  const ast = parse('export const x = 10;')

  const transformed = transform(ast, [visitors]);
  assertCodeEqual(t, ast, transformed);
});

test('don\'t change source with a specifier', (t) => {
  const ast = parse('const x = 10; export { x as y };')

  const transformed = transform(ast, [visitors]);
  assertCodeEqual(t, ast, transformed);
});

test('don\'t change source with an export all', (t) => {
  const ast = parse('export * from "foo";')

  const transformed = transform(ast, [visitors]);
  assertCodeEqual(t, ast, transformed);
});