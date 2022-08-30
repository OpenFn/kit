import test from 'ava';
import { builders as b, builders } from 'ast-types';

import transform, { buildvisitorMap } from '../src/transform';

const noop = () => false;

test('build a visitor map with one visitor', (t) => {
  const visitors = [{ types: ['CallExpression'], visitor: noop }];

  const map = buildvisitorMap(visitors);

  t.truthy(map.visitCallExpression);
  t.assert(map.visitCallExpression.length === 1);
});

test('build a visitor map with multiple visitors', (t) => {
  const visitors = [
    { types: ['CallExpression'], visitor: noop },
    { types: ['VariableDeclaration'], visitor: noop }
  ];

  const map = buildvisitorMap(visitors);

  t.truthy(map.visitCallExpression);
  t.assert(map.visitCallExpression.length === 1);

  t.truthy(map.visitVariableDeclaration);
  t.assert(map.visitVariableDeclaration.length === 1);
});

test('build a visitor map with multiple visitors of the same type', (t) => {
  const visitors = [
    { types: ['CallExpression'], visitor: noop },
    { types: ['CallExpression'], visitor: noop }
  ];
  
  const map = buildvisitorMap(visitors);
  
  t.truthy(map.visitCallExpression);
  t.assert(map.visitCallExpression.length === 2);
});

test('transform will visit nodes once', (t) => {
  let visitCount = 0;
  const visitor = () => { visitCount++ };
  const visitors = [{ types: ['CallExpression'], visitor }];

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
  const visitors = [{ types: ['CallExpression'], visitor }];

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

test('transform will stop if a visitor returns true', (t) => {
  let visitCount = 0;
  const visitor = () => ++visitCount;
  const visitors = [{ types: ['CallExpression'], visitor }];

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

