/*
 * Ensure that the AST has an `export default []` declaration
 * This will not move operations into the default export
 * This will do nothing if the source already declares any kind of exports
 */
import { builders as b, namedTypes } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';
// Note that the validator should complain if it see anything other than export default []
// What is the relationship between the validator and the compiler?

function visitor(path: NodePath<namedTypes.Program>) {
  // check the export statements
  // if we find any, we do nothing
  const currentExport = path.node.body.find(({ type }) => type.match(/Export/));
  if (currentExport) {
    return true;
  }

  // Add an empty export default statement as the final statement
  const newExport = buildExports();
  path.node.body.push(newExport);

  return true;
}

// This will basically create `default export [];`
const buildExports = () => b.exportDefaultDeclaration(b.arrayExpression([]));

export default {
  id: 'ensure-exports',
  types: ['Program'],
  visitor,
} as Transformer;
