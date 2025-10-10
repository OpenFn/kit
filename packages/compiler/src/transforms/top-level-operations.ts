/*
 * Move any top-level operations into the default exports array
 */

import { namedTypes as n, namedTypes } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';
// Note that the validator should complain if it see anything other than export default []
// What is the relationship between the validator and the compiler?

export type ExtendedProgram = NodePath<
  namedTypes.Program & {
    operations: Array<{ line: number; name: string; order: number }>;
  }
>;

export type TopLevelOpsOptions = {
  // Wrap operations in a `(state) => op` wrapper
  wrap: boolean; // TODO
};

function visitor(programPath: ExtendedProgram) {
  const operations: Array<{ line: number; name: string; order: number }> = [];
  const children = programPath.node.body;
  const rem = [];

  const target = programPath.node.body.at(-1);
  if (
    n.ExportDefaultDeclaration.check(target) &&
    n.ArrayExpression.check(target.declaration)
  ) {
    for (const child of children) {
      if (
        n.ExpressionStatement.check(child) &&
        n.CallExpression.check(child.expression)
      ) {
        const order = operations.length + 1;
        // @ts-ignore
        const name = child.expression.callee.name;
        const line = child.expression.loc?.start.line ?? -1;
        operations.push({ name, line, order });
        target.declaration.elements.push(child.expression as any);
      } else rem.push(child);
    }
    programPath.node.body = rem;
  } else {
    // error! there isn't an appropriate export statement
    // What do we do?
  }
  programPath.node.operations = operations;

  // if not (for now) we should cancel traversal
  return true;
}

export default {
  id: 'top-level-operations',
  types: ['Program'],
  visitor,
} as unknown as Transformer;
