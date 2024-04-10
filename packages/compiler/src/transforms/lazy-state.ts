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

    // Now nest the whole thing in an arrow
    const params = b.identifier('state');
    const arrow = b.arrowFunctionExpression([params], path.node);
    path.replace(arrow);
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
