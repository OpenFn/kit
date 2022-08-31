/*
 * Ensure that the AST has an `export default []` declaration
 * This will not move operations into the default export
 * This will do nothing if the source already declares any kind of exports
 */
import { builders as b } from 'ast-types';
// @ts-ignore
import type { NodePath } from 'ast-types/main.d.ts'
// Note that the validator should complain if it see anything other than export default []
// What is the relationship between the validator and the compiler?

function visitor(path: typeof NodePath) {
  // check the export statements
  // if we find any, we do nothing
  const currentExport = path.node.body.find(
    ({ type }: typeof NodePath) => type.match(/Export/)
  );
  if (currentExport) {
    return;
  }

  // Add an empty export default statement as the final statement
  const newExport = buildExports();
  path.node.body.push(newExport);
}

// This will basically create `default export [];`
const buildExports = () => b.exportDefaultDeclaration(
  b.arrayExpression([])
)

export default {
  types: ['Program'],
  visitor,
}