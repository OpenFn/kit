/*
 * Move any top-level operations into the default exports array
 */

import { namedTypes as n, namedTypes } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';
// Note that the validator should complain if it see anything other than export default []
// What is the relationship between the validator and the compiler?

export type ExtendedProgram = NodePath<namedTypes.Program> & {
  operations: Array<{ line: number; name: string; order: number }>;
};

export type TopLevelOpsOptions = {
  // Wrap operations in a `(state) => op` wrapper
  wrap: boolean; // TODO
};

function visitor(path: NodePath<namedTypes.CallExpression>) {
  const root = path.parent.parent.node;
  // Check if the node is a top level Operation
  if (
    // Check this is a top level call expression
    // ie, the parent must be an ExpressionStatement, and the statement's parent must be a Program
    n.Program.check(root) &&
    n.Statement.check(path.parent.node) &&
    // An Operation could be an Identifier (fn()) or Member Expression (http.get())
    (n.Identifier.check(path.node.callee) ||
      n.MemberExpression.check(path.node.callee))
  ) {
    appendOperationMetadata(path, root as unknown as ExtendedProgram);

    // Now Find the top level exports array
    const target = root.body.at(-1);
    if (
      n.ExportDefaultDeclaration.check(target) &&
      n.ArrayExpression.check(target.declaration)
    ) {
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

// Add metadata to each operation for:
// - the order (do we know? We can guess from the state of the exports array
// - the name of the operation
// - the original line number (do we know?)
function appendOperationMetadata(
  path: NodePath<namedTypes.CallExpression>,
  root: ExtendedProgram
) {
  if (!root.operations) {
    root.operations = [];
  }

  const { operations } = root;
  const order = operations.length + 1;
  const name = path.value.callee.name;
  const line = path.value.loc?.start.line ?? -1;

  operations.push({ line, order, name });
}

export default {
  id: 'top-level-operations',
  types: ['CallExpression'],
  visitor,
} as Transformer;
