/*
 * Convert $.a.b.c references into (state) => state.a.b.c
 *
 * Converts all $.a.b chains unless:
 * - $ was assigned previously in that scope
 *
 * TODO (maybe):
 *  - only convert $-expressions which are arguments to operations (needs type defs)
 *  - warn if converting a non-top-level $-expression
 *  - if not top level, convert to state.a.b.c (ie don't wrap the function)
 */
import { builders as b, namedTypes } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';

// Walk up the AST and work out where the parent arrow function should go
// This should be on the argument to the operation. So the top of whatever
// structure we are in
// If there's already a (state) wrapper, happily do nothing
// if there's anything else, throw an error
const ensureParentArrow = (path: NodePath<namedTypes.MemberExpression>) => {
  let root;

  // find the parenting call expression
  // find the matching argument (which argument is == last?)
  // maybe wrap the argument

  let last;
  let callexpr;
  let arg;
  // while (!root) {
  //   //

  //   root = root.parent;

  // }

  // Now nest the whole thing in an arrow
  const params = b.identifier('state');
  const arrow = b.arrowFunctionExpression([params], path.node);
  arg.replace(arrow);
};

// Checks whether the passed node is an open function, ie, (state) => {...}
const isOpenFunction = (path: NodePath<any>) => {
  // is it a function?
  //   -return false
  // does it have one param?
  //  continue else throw
  // is the param called state?
  //  return true else throw
};

function visitor(path: NodePath<namedTypes.MemberExpression>) {
  let first = path.node.object;
  while (first.hasOwnProperty('object')) {
    first = (first as namedTypes.MemberExpression).object;
  }

  let firstIdentifer = first as namedTypes.Identifier;

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

    ensureParentArrow();
  }

  // Stop parsing this member expression
  return false;
}

export default {
  id: 'lazy-state',
  types: ['MemberExpression'],
  visitor,
  // It's important that $ symbols are escaped before any other transformations can run
  order: 0,
} as Transformer;
