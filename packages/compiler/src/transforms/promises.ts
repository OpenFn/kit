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
      //return Promise.resolve(fn(state)).catch(error).then(complete);

      return Promise.resolve(fn(state)).then(complete);
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

// TODO how do I explain this
/*
This function will replace a promise chain of the form

op().then().then()

With a defer function call, which breaks the operation and promise chain into two parts

defer(op(), p => p.then().then())

defer will lazily resolve the operation,then feed the result into the promise chain in the second argument

*/

export const wrapFn = (expr: NodePath<n.CallExpression>) => {
  // pull out the callee, then and catch expressions

  // Pull out the the Operation being chained

  // We've just been handed something like looks like an operation with a promise chain
  // ie, op().then().then()
  // Walk down the call expression tree until we find the operation that's originally called
  let op: NodePath<n.CallExpression>;
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

  // Save the parent then/catch exp
  // ALWAYs move the op
  // if the parent is a catch, take the function and add it as the third arg, then remove the catch
  // now carry on with whatever is left in the chain

  // Build the arguments to the defer array (TODO, rename deferArgs)
  const children = [op.node];
  let catchFn;

  if (op.parent.node.property?.name === 'catch') {
    //  If there's a catch adjacent to the operation, we need to handle that a bit differently
    catchFn = op.parent.parent.node.arguments[0];
  }

  // In the promise chain, replace the operation call with `p`, a promise
  op.replace(b.identifier('p'));

  if (catchFn) {
    // remove the catch from the tree

    // TODO if there's a catch.then(), if if there's more than the catch
    // then I need to prune the catch and rebuild the remaining chain from p
    // op.parent.parent.prune();

    // Otherwise, I need to force the expressuion to be undefined
    children.push(b.identifier('undefined'));

    // if there's something left, we have to graft p onto it
  }

  // What I'd like to do here is say: if there's still a then() chain,
  // add it as the second argument
  // Otherwise, add undefined
  if (!catchFn) {
    const chain = b.arrowFunctionExpression([b.identifier('p')], expr.node);
    if (chain) {
      children.push(chain);
    }
  }

  if (catchFn) {
    children.push(catchFn);
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
