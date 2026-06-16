// Strips all non-exported top-level code (operations, export default, bare declarations).
// Runs before all other transformers (order: 0). No-op unless options === true.

import { namedTypes as n } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';

function visitor(
  programPath: NodePath<n.Program>,
  _logger: any,
  options: boolean | {} = {}
) {
  if (options !== true) return;

  programPath.node.body = programPath.node.body.filter(
    (node) =>
      n.ImportDeclaration.check(node) || n.ExportNamedDeclaration.check(node)
  ) as any;

  return true; // abort further traversal
}

export default {
  id: 'exports-only',
  types: ['Program'],
  order: 0,
  visitor,
} as unknown as Transformer;
