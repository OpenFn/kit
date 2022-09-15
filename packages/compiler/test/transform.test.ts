import test from 'ava';
import { builders as b } from 'ast-types';
import {visit} from 'recast';

import transform, { buildvisitorMap, buildVisitorMethods, TransformerName } from '../src/transform';

const noop = () => false;

const TEST = 'test' as TransformerName;
const ENSURE_EXPORTS = 'ensure-exports' as TransformerName;

test('build a visitor map with one visitor', (t) => {
  const visitors = [{ id: TEST, types: ['CallExpression'], visitor: noop }];

  const map = buildvisitorMap(visitors);

  t.truthy(map.visitCallExpression);
  t.assert(map.visitCallExpression.length === 1);
});

test('build a visitor map with multiple visitors', (t) => {
  const visitors = [
    { id: TEST, types: ['CallExpression'], visitor: noop },
    { id: TEST, types: ['VariableDeclaration'], visitor: noop }
  ];

  const map = buildvisitorMap(visitors);

  t.truthy(map.visitCallExpression);
  t.assert(map.visitCallExpression.length === 1);

  t.truthy(map.visitVariableDeclaration);
  t.assert(map.visitVariableDeclaration.length === 1);
});

test('build a visitor map with multiple visitors of the same type', (t) => {
  const visitors = [
    { id: TEST, types: ['CallExpression'], visitor: noop },
    { id: TEST, types: ['CallExpression'], visitor: noop }
  ];
  
  const map = buildvisitorMap(visitors);
  
  t.truthy(map.visitCallExpression);
  t.assert(map.visitCallExpression.length === 2);
});

test('transform will visit nodes once', (t) => {
  let visitCount = 0;
  const visitor = () => { visitCount++ };
  const visitors = [{ id: TEST, types: ['CallExpression'], visitor }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(
        b.identifier('jam'),
        []
      )
    )
  ]);

  transform(program, visitors);
  t.assert(visitCount === 1)
});

test('transform will visit nested nodes', (t) => {
  let visitCount = 0;
  const visitor = () => { visitCount++ };
  const visitors = [{ id: TEST, types: ['CallExpression'], visitor }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(
        b.callExpression(b.identifier('jam'), []),
        []
      )
    )
  ]);
  transform(program, visitors);
  t.assert(visitCount === 2)
});

test('transform will stop if a visitor returns truthy', (t) => {
  let visitCount = 0;
  const visitor = () => Boolean(++visitCount);
  const visitors = [{ id: TEST, types: ['CallExpression'], visitor }];

  const program = b.program([
    b.expressionStatement(
      b.callExpression(
        b.callExpression(b.identifier('jam'), []),
        []
      )
    )
  ]);
  transform(program, visitors);
  t.assert(visitCount === 1)
});

test('ignore disabled visitors', (t) => {
  const visitors = [{ id: TEST, types: ['Program'], visitor: noop }];

  const map = buildvisitorMap(visitors, { 'test': false });

  // Should add no visitors
  t.assert(Object.keys(map).length === 0);
});

test('passes options to a visitor', (t) => {
  let result;
  const visitor = (_node: unknown, options: any) => {
    result = options.value;
  }
  const visitors = [{ id: TEST, types: ['Program'], visitor }];

  // Build a visitor map which should trap the options
  const map = buildvisitorMap(visitors, { [TEST]: { value: 42 }});

  // Visit an AST and ensure the visitor is called with the right options
  visit(b.program([]), buildVisitorMethods(map))

  t.assert(result === 42);
});

test('passes options to several visitors', (t) => {
  let total = 0;
  const visitor = (_node: unknown, options: any) => {
    total += options.value;
  }
  const visitors = [
    { id: TEST, types: ['Program'], visitor },
    { id: TEST, types: ['Program'], visitor }
  ];

  // Build a visitor map which should trap the options
  const map = buildvisitorMap(visitors, { [TEST]: { value: 2 }});
  
  // Visit an AST and ensure the visitor is called with the right options
  visit(b.program([]), buildVisitorMethods(map))

  t.assert(total === 4);
});

test('passes options to the correct visitor', (t) => {
  let x;
  let y;

  const visitor_a = (_node: unknown, options: any) => {
    x = options.value;
  };
  const visitor_b = (_node: unknown, options: any) => {
    y = options.value;
  };
  const visitors = [
    { id: ENSURE_EXPORTS, types: ['Program'], visitor: visitor_a },
    { id: TEST, types: ['Program'], visitor: visitor_b  }
  ];

  // Build a visitor map which should trap the options
  const options = {
    [ENSURE_EXPORTS]:  {value: 99 }, // x
    [TEST]: {value: 42 } // y
  }
  const map = buildvisitorMap(visitors, options);

  // Visit an AST and ensure the visitor is called with the right options
  visit(b.program([]), buildVisitorMethods(map))

  t.assert(x === 99);
  t.assert(y === 42);
});