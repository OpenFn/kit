import { namedTypes as n, builders as b } from 'ast-types';

import type { NodePath } from 'ast-types/lib/node-path';

const NO_DEFER_DECLARATION_ERROR = 'No defer declaration found';

export const assertDeferDeclaration = (
  program: NodePath<n.Program> | n.Program
) => {
  if ((program as NodePath).node) {
    program = (program as NodePath).node;
  }
  const p = program as n.Program;
  for (const node of p.body) {
    if (n.ImportDeclaration.check(node)) {
      if (node.source.value === '@openfn/runtime') {
        return true;
      }
    }
  }

  throw new Error(NO_DEFER_DECLARATION_ERROR);
};

const injectDeferImport = (root: NodePath<n.Program>) => {
  try {
    assertDeferDeclaration(root);
  } catch (e) {
    if (e.message === NO_DEFER_DECLARATION_ERROR) {
      const i = b.importDeclaration(
        [b.importSpecifier(b.identifier('defer'), b.identifier('_defer'))],
        b.stringLiteral('@openfn/runtime')
      );

      // Find the first non-import node and
      let idx = 0;
      for (const node of root.node.body) {
        if (!n.ImportDeclaration.check(node)) {
          break;
        }
        idx++;
      }
      root.node.body.splice(idx, 0, i);
    }
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
  const defer = b.callExpression(b.identifier('_defer'), deferArgs);

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
    injectDeferImport(root);
    rebuildPromiseChain(path);

    // do not traverse this tree any further
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
