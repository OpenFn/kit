/*
 * Convert $.a.b.c references into (state) => state.a.b.c
 * Should this only run at top level?
 * Ideally it would run on all arguments to operations - but we probably don't really know what an operation is
 * So for now, first pass, it's only top level.
 * (alternatively I guess it just dumbly converts everything and if it breaks, it breaks)
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
  while(first.hasOwnProperty('object')) {
    first = (first as namedTypes.MemberExpression).object;
  }

  let firstIdentifer = first as namedTypes.Identifier;
  
  if (first && firstIdentifer.name === "$") {
    // rename $ to state
    firstIdentifer.name = "state";

    // Now nest the whole thing in an arrow
    const params = b.identifier('state')
    const arrow = b.arrowFunctionExpression(
      [params],
      path.node
    )
    path.replace(arrow)
  }

  // Stop parsing this member expression
  return;
}

export default {
  id: 'lazy-state',
  types: ['MemberExpression'],
  visitor,
} as Transformer;
