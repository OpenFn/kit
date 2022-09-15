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
import type { Visitor } from '../transform';
// @ts-ignore
import type { NodePath } from 'ast-types/main.d.ts'

// tmp
import { print, visit } from 'recast';

export type AddImportsOptions = {
  // Adaptor MUSt be pre-populated for this transformer to actually do anything
  adaptor: {
    name: string;
    exports: string[],
  };
}

// Find a list of all identifiers that haven't been declared in this AST
// TODO typings
// TODO is this just too difficult to do for all cases? Nested expressions are really hard
export function findAllDanglingIdentifiers(ast: any /*TODO*/) {
  const result = {};
  visit(ast, {
    visitIdentifier: function (path: NodePath) {
      // If this is the top object of a member expression
      const isMemberExpression =  n.MemberExpression.check(path.parentPath.node);
      if (isMemberExpression) {
        const isTopMemberExpression =  !n.MemberExpression.check(path.parentPath.parentPath.node);
        const isObject = path.parentPath.node.object.name === path.node.name;
        // console.log(`${path.node.name}:
        //   isMemberExpression: ${isMemberExpression}
        //   isTopMemberExpression: ${isTopMemberExpression}
        //   isObject: ${isObject}`
        // )
        if (!isTopMemberExpression || !isObject) {
          return false;
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

function visitor(path: typeof NodePath, options: AddImportsOptions) {
  if (options.adaptor) {
    const { name, exports } = options?.adaptor;
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