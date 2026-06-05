/*
 * Strip all non-exported top-level code.
 *
 * Keeps: import declarations and named export declarations.
 * Drops: expression statements (operations), export default, and bare
 *        top-level declarations that are not referenced by any kept export.
 *
 * Non-exported declarations that are transitively referenced by a kept
 * export declaration are preserved (tree-shaking).
 *
 * This transformer is designed to run before all others (order: 0).
 * It is a no-op unless explicitly enabled via options['exports-only'] = true.
 */

import { namedTypes as n } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';

// Recursively collect all Identifier names referenced in a node.
// Conservative: includes property names in member expressions (avoids false negatives).
export const collectRefs = (
  node: any,
  refs = new Set<string>()
): Set<string> => {
  if (!node || typeof node !== 'object') return refs;
  if (Array.isArray(node)) {
    node.forEach((item) => collectRefs(item, refs));
    return refs;
  }
  if (n.Identifier.check(node)) refs.add(node.name);
  for (const key of Object.keys(node)) {
    if (
      key === 'type' ||
      key === 'loc' ||
      key === 'comments' ||
      key === 'tokens'
    )
      continue;
    collectRefs(node[key], refs);
  }
  return refs;
};

// Build a map from declared name → statement for non-export top-level declarations.
export const buildDeclMap = (
  nodes: n.Statement[]
): Map<string, n.Statement> => {
  const map = new Map<string, n.Statement>();
  for (const node of nodes) {
    if (n.VariableDeclaration.check(node)) {
      for (const d of node.declarations) {
        if (n.Identifier.check((d as n.VariableDeclarator).id)) {
          map.set(((d as n.VariableDeclarator).id as n.Identifier).name, node);
        }
      }
    } else if (n.FunctionDeclaration.check(node) && node.id) {
      map.set(node.id.name, node);
    }
  }
  return map;
};

// Transitively collect all declarations that the seed nodes depend on.
export const collectDeps = (
  seeds: n.Statement[],
  declMap: Map<string, n.Statement>
): Set<n.Statement> => {
  const result = new Set<n.Statement>(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const current = queue.shift()!;
    for (const ref of Array.from(collectRefs(current))) {
      const dep = declMap.get(ref);
      if (dep && !result.has(dep)) {
        result.add(dep);
        queue.push(dep);
      }
    }
  }
  return result;
};

function visitor(
  programPath: NodePath<n.Program>,
  _logger: any,
  options: boolean | {} = {}
) {
  // Only run when explicitly enabled
  if (options !== true) return;

  const body = programPath.node.body;

  // Bare (non-export, non-import) top-level statements — candidates for tree-shaking
  const nonExported = body.filter(
    (node) =>
      !n.ImportDeclaration.check(node) &&
      !n.ExportNamedDeclaration.check(node) &&
      !n.ExportDefaultDeclaration.check(node)
  ) as n.Statement[];

  const declMap = buildDeclMap(nonExported);

  // Seed tree-shaking from all named export declarations
  const exportSeeds = body.filter((node) =>
    n.ExportNamedDeclaration.check(node)
  ) as n.Statement[];

  // Transitively collect non-exported declarations that exports depend on
  const needed = collectDeps(exportSeeds, declMap);

  // Keep imports, named exports, and their transitive non-exported dependencies
  programPath.node.body = body.filter(
    (node) =>
      n.ImportDeclaration.check(node) ||
      n.ExportNamedDeclaration.check(node) ||
      needed.has(node as n.Statement)
  ) as any;

  return true; // abort further traversal
}

export default {
  id: 'exports-only',
  types: ['Program'],
  order: 0,
  visitor,
} as unknown as Transformer;
