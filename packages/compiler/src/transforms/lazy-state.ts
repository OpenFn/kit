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
import IgnoreRules from '../transform-ignore';

type LazyStateErrorOptions = {
  details?: string;
  fix?: string;
  pos?: any;
};

export class LazyStateError extends Error {
  fix?: string;
  details?: string;
  pos?: any;

  constructor(
    message: string,
    { details, fix, pos }: LazyStateErrorOptions = {}
  ) {
    const posStr = (pos && `(${pos.start.line}:${pos.start.column})`) ?? '';
    super(`Lazy State Error: ${message} ${posStr}`);

    this.fix = fix;
    this.details = details;
    const { start, end, ..._rest } = pos;
    this.pos = { start, end };
    delete this.stack;
  }
}

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
    if (n.Statement.check(root.node) || n.Declaration.check(root.node)) {
      throw new LazyStateError('Must be inside an operation', {
        pos: path.node.loc,
        details:
          'The Lazy State operation must be used inside a top-level operation, like fn(). It cannot be used inside a regular JavaScript statement because no valid state reference is available.',
      });
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
    throw new LazyStateError('must be passed as an argument to an operator', {
      pos: path.node.loc,
    });
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
      throw new LazyStateError(`parameter "${name}" should be called "state"`, {
        pos: path.node.loc,
      });
    }
    throw new LazyStateError('parent has wrong arity', { pos: path.node.loc });
  }

  // if we get here, then path is:
  // a) a Javascript Expression (and not an arrow)
  // b) appropriate for being wrapped in an arrow
  return false;
};

function visitor(path: NodePath<n.MemberExpression>) {
  // if it was called for an ObjectExpression
  const ignoreRule = IgnoreRules(path);
  if (ignoreRule.check) {
    return ignoreRule.shouldSkip();
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
