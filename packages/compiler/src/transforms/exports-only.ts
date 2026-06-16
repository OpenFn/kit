/*
 * Strips all non-exported top-level code (operations, export default, bare declarations).
 */

import { namedTypes as n } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';

// Returns true if compiled output contains any declarations worth importing in tests.
export const hasExportableCode = (code: string): boolean =>
  /^\s*export\s+(const|let|var|function|class)\s/m.test(code);

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
