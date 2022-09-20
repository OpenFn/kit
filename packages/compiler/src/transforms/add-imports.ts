/*
 * For a given adaptor, add import statements
 *    - load the d.ts for that adaptor
 *    - import every export
 *    - maybe only import the things we need
 * 
 * This needs to accept an external argument
 * This will only work with 2.0 adaptors with type defs
 */
import { builders as b, namedTypes as n } from 'ast-types';
import type { NodePath } from 'ast-types/lib/node-path';
import type { ASTNode } from 'ast-types';
import { visit } from 'recast';
import type { Visitor } from '../transform';

export type AddImportsOptions = {
  // Adaptor MUST be pre-populated for this transformer to actually do anything
  adaptor: {
    name: string;
    exports: string[],
  };
}

export type IdentifierList = Record<string, true>;

// Find a list of all identifiers that haven't been declared in this AST
export function findAllDanglingIdentifiers(ast: ASTNode) {
  const result: IdentifierList = {};
  visit(ast, {
    visitIdentifier: function (path) {
      // If this is the top object of a member expression
      if (n.MemberExpression.check(path.parentPath.node)) {
        // If this identifier is the subject of any part of an expression chain, it's not a dangler
        let target = path;
        let parent = path.parentPath;
        while(parent.node.property) {
          // Check if target node is a property
          if (parent.node.property === target.node) {
            // If so, abort traversal
            return false;
          }
          // Step up the tree
          target = parent;
          parent = parent.parentPath;
        }
      }
      // If this identifier was declared in this scope, ignore it
      let scope = path.scope;
      while (scope) {
        if (scope.declares(path.node.name)) {
          return false;
        }
        scope = scope.parent;
      }
      result[path.node.name] = true;
      this.traverse(path);
    }
  })
  return result;
}

function visitor(path: NodePath, options: AddImportsOptions) {
  if (options.adaptor) {
    const { name, exports } = options.adaptor;
    if (name && exports) {
      const identifiers = findAllDanglingIdentifiers(path.node);
      const usedExports = exports.filter((e) => identifiers[e])
      if (usedExports.length) {
        const i = b.importDeclaration(
          usedExports.map(e => b.importSpecifier(b.identifier(e))),
          b.stringLiteral(name)
        );
        path.get("body").insertAt(0, i);
      }
    }
  }
}

export default {
  id: 'add-imports',
  types: ['Program'],
  visitor,
} as Visitor;