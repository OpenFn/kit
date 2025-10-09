import test from 'ava';
import { builders as b, namedTypes as n } from 'ast-types';

import transform from '../../src/transform';
import parse from '../../src/parse';
import visitors from '../../src/transforms/top-level-operations';
import { assertCodeEqual } from '../util';

const createProgramWithExports = (statements) =>
  b.program([...statements, b.exportDefaultDeclaration(b.arrayExpression([]))]);

const createOperationStatement = (name, args: any[] = []) =>
  b.expressionStatement(b.callExpression(b.identifier(name), args));

test('visits a Call Expression node', (t) => {
  let visitCount = 0;
  const mockVisitors = [
    {
      types: visitors.types,
      visitor: () => {
        visitCount++;
      },
    },
  ];

  const program = b.program([
    b.expressionStatement(b.callExpression(b.identifier('fn'), [])),
  ]);

  transform(program, mockVisitors);
  t.assert(visitCount === 1);
});

test('moves an operation into the exports array', (t) => {
  const ast = createProgramWithExports([createOperationStatement('fn')]);

  const { body } = transform(ast, [visitors]) as n.Program;
  // should only be ony top level child
  t.assert(body.length === 1);

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]));
  const dec = (body[0] as n.ExportDefaultDeclaration).declaration;

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(dec));
  const arr = dec as n.ArrayExpression;
  t.assert(arr.elements.length == 1);

  // And the one element should be a call to fn
  const call = arr.elements[0] as n.CallExpression;
  t.assert(n.CallExpression.check(call));
  t.assert(n.Identifier.check(call.callee));
  t.assert((call.callee as n.Identifier).name === 'fn');
});

test('moves multiple operations into the exports array', (t) => {
  const ast = createProgramWithExports([
    createOperationStatement('a'),
    createOperationStatement('b'),
    createOperationStatement('c'),
  ]);

  const { body } = transform(ast, [visitors]);
  // should only be ony top level child
  t.assert(body.length === 1);

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]));

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(body[0].declaration));
  t.assert(body[0].declaration.elements.length == 3);

  // Should be calls to a, b and c
  const [a, b, c] = body[0].declaration.elements;
  t.assert(a.callee.name === 'a');
  t.assert(b.callee.name === 'b');
  t.assert(c.callee.name === 'c');
});

test('does not move a nested operation into the exports array', (t) => {
  // fn(() => fn())
  const ast = createProgramWithExports([
    createOperationStatement('fn', [
      b.arrowFunctionExpression(
        [],
        b.callExpression(b.identifier('fn'), []),
        true
      ),
    ]),
  ]);

  const { body } = transform(ast, [visitors]);
  // should only be ony top level child
  t.assert(body.length === 1);

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]));

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(body[0].declaration));
  t.assert(body[0].declaration.elements.length == 1);

  // And the one element should be a call to fn
  const call = body[0].declaration.elements[0];
  t.assert(n.CallExpression.check(call));
  t.assert(n.Identifier.check(call.callee));
  t.assert(call.callee.name === 'fn');
});

test('moves a method call into the exports array', (t) => {
  const ast = createProgramWithExports([
    b.expressionStatement(
      b.callExpression(
        b.memberExpression(b.identifier('a'), b.identifier('b')),
        []
      )
    ),
  ]);

  const { body } = transform(ast, [visitors]);

  // should only be ony top level child
  t.assert(body.length === 1);

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]));

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(body[0].declaration));
  t.assert(body[0].declaration.elements.length == 1);

  // And the one element should be a call to http.get
  const call = body[0].declaration.elements[0];
  t.assert(n.CallExpression.check(call));
  t.assert(n.MemberExpression.check(call.callee));

  t.is(call.callee.object.name, 'a');
  t.is(call.callee.property.name, 'b');
});

test('does not move a method call inside an assignment', (t) => {
  const ast = createProgramWithExports([
    b.variableDeclaration('const', [
      b.variableDeclarator(
        b.identifier('x'),
        b.callExpression(
          b.memberExpression(b.identifier('a'), b.identifier('b')),
          []
        )
      ),
    ]),
  ]);

  const { body } = transform(ast, [visitors]);

  // should add the export
  t.is(body.length, 2);

  // The first child should be an variable declaration
  t.true(n.VariableDeclaration.check(body[0]));

  // the exported array should be empty
  t.is(body[1].declaration.elements.length, 0);
});

test("does nothing if there's no export statement", (t) => {
  const ast = b.program([createOperationStatement('fn')]);

  const transformed = transform(ast, [visitors]) as n.Program;
  // should only be ony top level child
  t.assert(transformed.body.length === 1);

  // That child should be an expression statement
  t.assert(n.ExpressionStatement.check(transformed.body[0]));

  // In fact the code should be unchanged
  assertCodeEqual(t, ast, transformed);
});

test('should only take the top of a nested operation call (and preserve its arguments)', (t) => {
  // ie combine(fn()) -> export default [combine(fn())];
  const ast = createProgramWithExports([
    createOperationStatement('combine', [
      b.callExpression(b.identifier('fn'), []),
    ]),
  ]);

  const { body } = transform(ast, [visitors]) as n.Program;
  // should only be ony top level child
  t.assert(body.length === 1);

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]));
  const dec = (body[0] as n.ExportDefaultDeclaration).declaration;

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(dec));
  const arr = dec as n.ArrayExpression;
  t.assert(arr.elements.length == 1);

  // And the one element should be a call to combine
  const combine = arr.elements[0] as n.CallExpression;
  t.assert(n.CallExpression.check(combine));
  t.assert(n.Identifier.check(combine.callee));
  t.assert((combine.callee as n.Identifier).name === 'combine');

  // Combine's first argument should be a call to fn
  const fn = combine.arguments[0] as n.CallExpression;
  t.assert(n.CallExpression.check(fn));
  t.assert(n.Identifier.check(fn.callee));
  t.assert((fn.callee as n.Identifier).name === 'fn');
});

// TODO Does nothing if the export statement is wrong

test('appends an operations map to simple operation', (t) => {
  // We have to parse source here rather than building an AST so that we get positional information
  const { program } = parse(`fn(); export default [];`);

  transform(program, [visitors]);

  // @ts-ignore
  const { operations } = program;
  t.deepEqual(operations, [
    {
      name: 'fn',
      line: 1,
      order: 1,
    },
  ]);
});
