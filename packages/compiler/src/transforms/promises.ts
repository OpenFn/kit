import * as acorn from 'acorn';
import { namedTypes as n, builders as b } from 'ast-types';

import type { NodePath } from 'ast-types/lib/node-path';

type State = any;

// Defer will take an operation with a promise chain
// and break it up into a deferred function call which
// ensures the operation is a promise
// eg, fn().then(s => s)
// TODO what about
// eg, fn().then(s => s).then(s => s)

// TODO not a huge fan of how this stringifies
// maybe later update tsconfig

// TODO if the complete function errors, what do we do?
// This should Just Work right?
// eg, fn().then(s => s).catch()
export function defer(
  fn: (s: State) => State,
  complete = (s: State) => s,
  error = (e: any): void => {
    throw e;
  }
) {
  return (state: State) => {
    try {
      return Promise.resolve(fn(state)).catch(error).then(complete);
    } catch (e) {
      error(e);
    }
  };
}

const assertDeferDeclaration = (program: NodePath<n.Program>) => {
  for (const node of program.node.body) {
    if (n.FunctionDeclaration.check(node)) {
      if (node.id.name === 'defer') {
        return true;
      }
    }
  }

  throw new Error('No defer declaration found');
};

const DEFER_SOURCE = defer.toString();

// TODO only do this once
const injectDeferFunction = (root: NodePath<n.Program>) => {
  try {
    assertDeferDeclaration(root);
  } catch (e) {
    const newAST = acorn.parse(DEFER_SOURCE, {
      sourceType: 'module',
      ecmaVersion: 10,
      locations: false,
    });

    // TODO work out the index of the first none import/export line
    const idx = -1;
    root.node.body.splice(idx + 1, 0, ...newAST.body);
  }
};

// This function will take a promise chain, a.then(x).catch(y),
// and convert it into defer(a, x, y)
export const wrapFn = (expr: NodePath<n.CallExpression>) => {
  // pull out the callee, then and catch expressions

  // Pull out the the Operation being chained
  const op = expr.node.callee.object;

  const children = [op];

  // not sure how well this wil scale tbh
  if (expr.node.callee.property.name === 'then') {
    children.push(expr.node.arguments[0]);
  } else if (expr.node.callee.property.name === 'catch') {
    children.push(b.identifier('undefined'));
    children.push(expr.node.arguments[0]);
  }

  const defer = b.callExpression(b.identifier('defer'), children);

  expr.replace(defer);

  return defer;
};

const isTopScope = (path: NodePath<any>) => {
  let parent = path.parent;
  while (parent) {
    if (n.Program.check(parent)) {
      return true;
    }
    if (
      n.ArrowFunctionExpression.check(parent) ||
      n.FunctionDeclaration.check(parent) ||
      n.FunctionExpression.check(parent) ||
      n.BlockStatement.check(parent)
      // TODO more?
    ) {
      return false;
    }
    parent = parent.parent;
  }
  return true;
};

const visitor = (path: NodePath<n.CallExpression>) => {
  let root: NodePath<n.Program> = path;
  while (!n.Program.check(root.node)) {
    root = root.parent;
  }

  // any Call expression with then|catch which is not in a nested scope
  if (
    path.node.callee.property?.name?.match(/^(then|catch)$/) &&
    isTopScope(path)
  ) {
    injectDeferFunction(root);
    wrapFn(path);
  }
};

export default {
  id: 'promises',
  types: ['CallExpression'],
  visitor,
  // this should run before top-level operations are moved into the exports array
  order: 0,
} as Transformer;
