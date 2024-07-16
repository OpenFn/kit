import * as acorn from 'acorn';
import { namedTypes as n, builders as b } from 'ast-types';

import type { NodePath } from 'ast-types/lib/node-path';

type State = any;

// Defer will take an operation with a promise chain
// and break it up into a deferred function call which
// ensures the operation is a promise
// eg, fn().then(s => s)

// TODO not a huge fan of how this stringifies
// maybe later update tsconfig
export function defer(
  fn: (s: State) => State,
  complete = (p: Promise<any>) => p,
  error = (e: any): void => {
    throw e;
  }
) {
  return (state: State) => {
    try {
      return complete(Promise.resolve(fn(state)).catch(error));
    } catch (e) {
      return error(e);
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

/*
  This function will replace a promise chain of the form op().then().then()
  with a defer() function call, which breaks the operation and promise chain
  into two parts, like this:

  defer(op(), p => p.then().then())
*/
export const rebuildPromiseChain = (expr: NodePath<n.CallExpression>) => {
  // We've just been handed something like looks like an operation with a promise chain
  // ie, op().then().then()
  // Walk down the call expression tree until we find the operation that's originally called
  let op: NodePath<n.CallExpression> | null = null;
  let next = expr;
  while (next) {
    if (n.Identifier.check(next.node.callee)) {
      op = next;
      break;
    }
    if (
      n.MemberExpression.check(next.node.callee) &&
      !next.node.callee.property.name?.match(/^(then|catch)$/)
    ) {
      op = next;
      break;
    } else {
      next = next.get('callee', 'object');
    }
  }

  if (!op) {
    // If somehow we can't find the underling operation, abort
    return;
  }

  // Build the arguments to the defer() array
  const deferArgs: any[] = [op.node];
  let catchFn;

  if (op.parent.node.property?.name === 'catch') {
    //  If there's a catch adjacent to the operation, we need to handle that a bit differently
    catchFn = op.parent.parent.get('arguments', 0);
  }

  // In the promise chain, replace the operation call with `p`, a promise
  op.replace(b.identifier('p'));

  // Now we re-build the promise chain
  // This is a bit different if the operation has a catch against it
  if (catchFn) {
    // remove the catch from the tree
    const parent = catchFn.parent.parent;

    // if this catch is part of a longer chain,
    // cut the catch out of the chain and replace it with p
    if (parent.node.object === catchFn.parent.node) {
      parent.get('object').replace(b.identifier('p'));
      const chain = b.arrowFunctionExpression([b.identifier('p')], expr.node);
      deferArgs.push(chain);
    } else {
      // Otherwise, if there is no then chain, just pass undefined
      deferArgs.push(b.identifier('undefined'));
    }
    deferArgs.push(catchFn.node);
  } else {
    // If there's no catch, reparent the entire promise chian into an arrow
    // ie, (p) => p.then().then()
    const chain = b.arrowFunctionExpression([b.identifier('p')], expr.node);
    if (chain) {
      deferArgs.push(chain);
    }
  }

  // Finally, build and return the defer function call
  const defer = b.callExpression(b.identifier('defer'), deferArgs);

  expr.replace(defer);

  return defer;
};

const isTopScope = (path: NodePath<any>) => {
  let parent = path.parent;
  while (parent) {
    if (n.Program.check(parent.node)) {
      return true;
    }
    if (
      n.ArrowFunctionExpression.check(parent.node) ||
      n.FunctionDeclaration.check(parent.node) ||
      n.FunctionExpression.check(parent.node) ||
      n.BlockStatement.check(parent.node)
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
    rebuildPromiseChain(path);
    // do not traverse this tree
    return true;
  }
};

export default {
  id: 'promises',
  types: ['CallExpression'],
  visitor,
  // this should run before top-level operations are moved into the exports array
  order: 0,
} as Transformer;
