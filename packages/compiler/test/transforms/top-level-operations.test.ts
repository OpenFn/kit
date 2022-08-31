import test from 'ava';
import { NodePath, builders as b, namedTypes as n  } from 'ast-types';

import transform from '../../src/transform';
import visitors from '../../src/transforms/top-level-operations';
import  { assertCodeEqual } from '../util';

const createProgramWithExports = (statements) =>
  b.program([
    ...statements,
    b.exportDefaultDeclaration(b.arrayExpression([]))
  ]);

const createOperationStatement = (name, args: any[] = []) =>
  b.expressionStatement(
    b.callExpression(
      b.identifier(name),
      args
    )
  );


test('visits a Call Expression node', (t) => {
  let visitCount = 0;
  const mockVisitors = [{
    types: visitors.types,
    visitor: () => { visitCount++; }
  }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(
        b.identifier('fn'),
        []
      )
    )
  ]);

  transform(program, mockVisitors);
  t.assert(visitCount === 1)
});

test('moves an operation into the exports array', (t) => {
  const ast = createProgramWithExports([
    createOperationStatement('fn')
  ]);

  const { body } = transform(ast, [visitors]);
  // should only be ony top level child
  t.assert(body.length === 1)

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]))

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(body[0].declaration))
  t.assert(body[0].declaration.elements.length == 1)

  // And the one element should be a call to fn
  const call = body[0].declaration.elements[0];
  t.assert(n.CallExpression.check(call));
  t.assert(n.Identifier.check(call.callee))
  t.assert(call.callee.name === "fn");
});

test('moves multiple operations into the exports array', (t) => {
  const ast = createProgramWithExports([
    createOperationStatement('a'),
    createOperationStatement('b'),
    createOperationStatement('c'),
  ]);

  const { body } = transform(ast, [visitors]);
  // should only be ony top level child
  t.assert(body.length === 1)

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]))

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(body[0].declaration))
  t.assert(body[0].declaration.elements.length == 3)

  // Should be calls to a, b and c
  const [a, b, c] = body[0].declaration.elements;
  t.assert(a.callee.name === "a");
  t.assert(b.callee.name === "b");
  t.assert(c.callee.name === "c");
});

test('does not move a nested operation into the exports array', (t) => {
  const ast = createProgramWithExports([
    createOperationStatement('fn', [
      b.arrowFunctionExpression(
        [],
        b.callExpression(
          b.identifier('fn'),
          []
        ),
        true
      )
    ])
  ]);

  const { body } = transform(ast, [visitors]);
  // should only be ony top level child
  t.assert(body.length === 1)

  // That child should be a default declaration
  t.assert(n.ExportDefaultDeclaration.check(body[0]))

  // The declaration should be an array of 1
  t.assert(n.ArrayExpression.check(body[0].declaration))
  t.assert(body[0].declaration.elements.length == 1)

  // And the one element should be a call to fn
  const call = body[0].declaration.elements[0];
  t.assert(n.CallExpression.check(call));
  t.assert(n.Identifier.check(call.callee))
  t.assert(call.callee.name === "fn");
});

test('does not move method call into the exports array', (t) => {
  const ast = createProgramWithExports([
    b.expressionStatement(
      b.callExpression(
        b.memberExpression(
          b.identifier('a'),
          b.identifier('b'),
        ),
        []
      )
    )
  ]);

  const { body } = transform(ast, [visitors]);
  // should be two top level children
  t.assert(body.length === 2)

  // Those children should still be an expression and export statement
  const [stmt, ex] = body;
  t.assert(n.ExpressionStatement.check(stmt))
  t.assert(n.ExportDefaultDeclaration.check(ex))

  // The declaration should be an array of 0
  t.assert(n.ArrayExpression.check(ex.declaration))
  t.assert(ex.declaration.elements.length == 0)
});

test('does nothing if there\'s no export statement', (t) => {
  const ast =   b.program([
    createOperationStatement('fn')
  ]);

  const transformed = transform(ast, [visitors]);
  // should only be ony top level child
  t.assert(transformed.body.length === 1)

  // That child should be an expression statement
  t.assert(n.ExpressionStatement.check(transformed.body[0]))

  // In fact the code should be unchanged
  assertCodeEqual(t, ast, transformed);
});

// Does nothing if the export statement is wrong
