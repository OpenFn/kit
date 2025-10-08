/*
 * Convert $.a.b.c references into (state) => state.a.b.c
 *
 * Converts all $.a.b chains unless:
 * - $ was assigned previously in that scope
 *
 *
 */
import { builders as b, namedTypes as n } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';

// Walk up the AST and work out where the parent arrow function should go
const ensureParentArrow = (path: NodePath<n.MemberExpression>) => {
  let root = path;
  let last;

  // find the parenting call expression
  // Ie, the operation we're passing this arrow into
  while (root && !n.CallExpression.check(root.node)) {
    last = root;
    root = root.parent;

    // if this is any kind of statement, we should throw
    // TODO we may relax this, see https://github.com/OpenFn/kit/issues/660
    if (n.Statement.check(root.node) || n.Declaration.check(root.node)) {
      throw new Error(`invalid state operator: must be inside an expression`);
    }
  }

  if (root && n.CallExpression.check(root.node)) {
    let arg = last as NodePath;
    if (
      arg.parentPath &&
      n.CallExpression.check(arg.parentPath.node) &&
      n.MemberExpression.check(arg.parentPath.node.callee) &&
      arg.parentPath.node.callee.object.name === 'state'
    ) {
      arg = arg.parentPath;
    }

    if (!isOpenFunction(arg)) {
      const params = b.identifier('state');
      const arrow = b.arrowFunctionExpression([params], arg.node);
      arg.replace(arrow);
    }
  } else {
    // Actually I don't think we'll ever get here
    throw new Error(
      `invalid state operator: must be be passed as an argument to an operator`
    );
  }
};

// Checks whether the passed node is an open function, ie, (state) => {...}
const isOpenFunction = (path: NodePath) => {
  // is it a function?
  if (n.ArrowFunctionExpression.check(path.node)) {
    const arrow = path.node as n.ArrowFunctionExpression;
    // does it have one param?
    if (arrow.params.length == 1) {
      const name = (arrow.params[0] as n.Identifier).name;
      // is the param called state?
      if (name === 'state') {
        // We already have a valid open function here
        return true;
      }
      throw new Error(
        `invalid state operator: parameter "${name}" should be called "state"`
      );
    }
    throw new Error('invalid state operator: parent has wrong arity');
  }

  // if we get here, then path is:
  // a) a Javascript Expression (and not an arrow)
  // b) appropriate for being wrapped in an arrow
  return false;
};

function visitor(path: NodePath<n.MemberExpression>) {
  // if it was called for an ObjectExpression
  if (n.ObjectExpression.check(path.node)) {
    if (
      n.VariableDeclarator.check(path.parentPath.node) &&
      n.VariableDeclaration.check(path.parentPath.parentPath.node) &&
      n.Program.check(path.parentPath.parentPath.parentPath.parentPath.node)
    ) {
      return true;
    }
    return false;
  }
  let first = path.node.object;
  while (first.hasOwnProperty('object')) {
    first = (first as n.MemberExpression).object;
  }

  let firstIdentifer = first as n.Identifier;

  if (first && firstIdentifer.name === '$') {
    // But if a $ declared a parent scope, ignore it
    let scope = path.scope;
    while (scope) {
      if (!scope.isGlobal && scope.declares('$')) {
        return false;
      }
      scope = scope.parent;
    }

    // rename $ to state
    firstIdentifer.name = 'state';

    // from the parenting member expression, ensure the parent arrow is nicely wrapped
    ensureParentArrow(path);
  }
}

export default {
  id: 'lazy-state',
  types: ['MemberExpression', 'ObjectExpression'],
  visitor,
  // It's important that $ symbols are escaped before any other transformations can run
  order: 0,
} as Transformer;
