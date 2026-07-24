/*
 * Strips all non-exported top-level code (operations, export default, bare declarations).
 */

import { namedTypes as n } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';

// Names referenced by bare export lists, eg export { x, y }
const findExportListNames = (body: any[]) => {
  const names = new Set<string>();
  for (const node of body) {
    if (
      n.ExportNamedDeclaration.check(node) &&
      !node.declaration &&
      !node.source
    ) {
      for (const spec of node.specifiers ?? []) {
        if (n.Identifier.check(spec.local)) {
          names.add(spec.local.name);
        }
      }
    }
  }
  return names;
};

const declaresName = (node: any, names: Set<string>) => {
  if (n.FunctionDeclaration.check(node) || n.ClassDeclaration.check(node)) {
    return Boolean(node.id && names.has(node.id.name));
  }
  if (n.VariableDeclaration.check(node)) {
    return node.declarations.some(
      (d) =>
        n.VariableDeclarator.check(d) &&
        n.Identifier.check(d.id) &&
        names.has(d.id.name)
    );
  }
  return false;
};

function visitor(programPath: NodePath<n.Program>) {
  const { body } = programPath.node;
  const exportListNames = findExportListNames(body);

  programPath.node.body = body.filter(
    (node) =>
      n.ImportDeclaration.check(node) ||
      n.ExportNamedDeclaration.check(node) ||
      n.ExportAllDeclaration.check(node) ||
      declaresName(node, exportListNames)
  ) as any;

  return true; // abort further traversal
}

export default {
  id: 'exports-only',
  types: ['Program'],
  order: 0,
  visitor,
} as unknown as Transformer;
