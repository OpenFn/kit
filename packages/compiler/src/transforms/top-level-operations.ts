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
  wrap?: boolean; // TODO
  // Strip operations instead of moving them into the export array (for test compilation)
  strip?: boolean;
};

// Recursively collect all Identifier names referenced in a node.
// Conservative: includes property names in member expressions (avoids false negatives).
export const collectRefs = (node: any, refs = new Set<string>()): Set<string> => {
  if (!node || typeof node !== 'object') return refs;
  if (Array.isArray(node)) {
    node.forEach(item => collectRefs(item, refs));
    return refs;
  }
  if (n.Identifier.check(node)) refs.add(node.name);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'comments' || key === 'tokens') continue;
    collectRefs(node[key], refs);
  }
  return refs;
};

// Build a map from declared name → statement for non-export top-level declarations.
export const buildDeclMap = (
  nodes: namedTypes.Statement[]
): Map<string, namedTypes.Statement> => {
  const map = new Map<string, namedTypes.Statement>();
  for (const node of nodes) {
    if (n.VariableDeclaration.check(node)) {
      for (const d of node.declarations) {
        if (n.Identifier.check((d as namedTypes.VariableDeclarator).id)) {
          map.set(
            ((d as namedTypes.VariableDeclarator).id as namedTypes.Identifier).name,
            node
          );
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
  seeds: namedTypes.Statement[],
  declMap: Map<string, namedTypes.Statement>
): Set<namedTypes.Statement> => {
  const result = new Set<namedTypes.Statement>(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const current = queue.shift()!;
    for (const ref of collectRefs(current)) {
      const dep = declMap.get(ref);
      if (dep && !result.has(dep)) {
        result.add(dep);
        queue.push(dep);
      }
    }
  }
  return result;
};

function visitor(programPath: ExtendedProgram, _logger: any, options: Partial<TopLevelOpsOptions> = {}) {
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
        if (!options.strip) {
          target.declaration.elements.push(child.expression as any);
        }
        // In strip mode: operation is neither moved to exports nor kept in body
      } else rem.push(child);
    }
    programPath.node.body = rem;

    if (options.strip) {
      // Remove the `defer as _defer` import injected by the promises transform.
      // All operations (and thus all _defer usages) have been stripped, so it's dead.
      programPath.node.body = programPath.node.body.filter(node => {
        if (!n.ImportDeclaration.check(node)) return true;
        if (node.source.value !== '@openfn/runtime') return true;
        const filtered = (node.specifiers ?? []).filter(s => {
          if (!n.ImportSpecifier.check(s)) return true;
          return (s.local as namedTypes.Identifier).name !== '_defer';
        });
        if (filtered.length === 0) return false;
        node.specifiers = filtered;
        return true;
      });

      // Tree-shake: keep only explicitly exported declarations and their dependencies.
      // Non-exported top-level declarations with no exported consumer are dropped.
      const body = programPath.node.body;

      const exportedDecls = body.filter(
        node =>
          n.ExportNamedDeclaration.check(node) &&
          (node as namedTypes.ExportNamedDeclaration).declaration != null
      ) as namedTypes.Statement[];

      const nonExported = body.filter(
        node =>
          !n.ImportDeclaration.check(node) &&
          !n.ExportDefaultDeclaration.check(node) &&
          !n.ExportNamedDeclaration.check(node)
      );
      const declMap = buildDeclMap(nonExported);

      const needed = collectDeps(exportedDecls, declMap);

      programPath.node.body = body.filter(
        node =>
          n.ImportDeclaration.check(node) ||
          n.ExportDefaultDeclaration.check(node) ||
          needed.has(node as namedTypes.Statement)
      );
    }
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
