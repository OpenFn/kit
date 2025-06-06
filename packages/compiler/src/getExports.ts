import recast from 'recast';
import * as acorn from 'acorn';
import { namedTypes as n } from 'ast-types';

function getExports(content: string) {
  const ast = recast.parse(content, {
    parser: {
      parse: (source: string) =>
        acorn.parse(source, {
          sourceType: 'module',
          ecmaVersion: 'latest',
          allowHashBang: true,
          locations: true,
        }),
    },
  });
  const exportIdentifiers: string[] = [];

  recast.types.visit(ast, {
    visitExportNamedDeclaration(path) {
      const node = path.node;
      if (node.declaration) {
        if (n.VariableDeclaration.check(node.declaration)) {
          node.declaration.declarations.forEach((decl) => {
            // @ts-ignore
            const id = decl.id;
            if (id && n.Identifier.check(id)) exportIdentifiers.push(id.name);
          });
        } else if (
          n.FunctionDeclaration.check(node.declaration) ||
          n.ClassDeclaration.check(node.declaration)
        ) {
          const id = node.declaration.id;
          if (id && n.Identifier.check(id)) exportIdentifiers.push(id.name);
        }
      } else if (node.specifiers) {
        node.specifiers.forEach((spec) => {
          exportIdentifiers.push(spec.exported.name);
        });
      }
      this.traverse(path);
    },
  });
  return exportIdentifiers;
}

export default getExports;
