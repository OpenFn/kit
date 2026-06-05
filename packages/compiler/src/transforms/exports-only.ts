// Strips all non-exported top-level code (operations, export default, bare declarations).
// Runs before all other transformers (order: 0). No-op unless options === true.

import { namedTypes as n } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { Transformer } from '../transform';

// Conservative: includes member expression property names to avoid false negatives.
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
  if (options !== true) return;

  const body = programPath.node.body;

  const nonExported = body.filter(
    (node) =>
      !n.ImportDeclaration.check(node) &&
      !n.ExportNamedDeclaration.check(node) &&
      !n.ExportDefaultDeclaration.check(node)
  ) as n.Statement[];

  const declMap = buildDeclMap(nonExported);
  const exportSeeds = body.filter((node) =>
    n.ExportNamedDeclaration.check(node)
  ) as n.Statement[];
  const needed = collectDeps(exportSeeds, declMap);

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
