/*
 * Move any top-level operations into the default exports array
 */

import { namedTypes as n } from 'ast-types';
// @ts-ignore
import type { NodePath } from 'ast-types/main.d.ts'
// Note that the validator should complain if it see anything other than export default []
// What is the relationship between the validator and the compiler?

function visitor(path: NodePath) {
  const root = path.parent.parent.node;
  // Check if the node is a top level Operation
  if (
    // Check this is a top level call expression
    // ie, the parent must be an ExpressionStatement, and the statement's parent must be a Program
    n.Program.check(root)
    && n.Statement.check(path.parent.node)
    
    // If it's an Operation call (ie, fn(() => {})), the callee will be an IdentifierExpression
    && n.Identifier.check(path.node.callee)) {
      // Now Find the top level exports array
      const target = root.body.at(-1)
      if (n.ExportDefaultDeclaration.check(target) && n.ArrayExpression.check(target.declaration)) {
        const statement = path.parent;
        target.declaration.elements.push(path.node);
        // orphan the original expression statement parent
        statement.prune();
      } else {
        // error! there isn't an appropriate export statement
        // What do we do?
      }
  }

  // if not (for now) we should cancel traversal
  // (should we only cancel traversal for this visitor?)
}


export default {
  types: ['CallExpression'],
  visitor,
}