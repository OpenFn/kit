/**
 * Parse a source string as an ESM module and return an AST representation
 * 
 * We use recast because:
 *   a) untouched parts of the AST will preserve formatting on serialisation
 *   b) it's very friendly towards source mapping
 * 
 * One observation is that the returned tree is significantly bigger because line
 * and token info is duplicated to every single node
 */
import recast from 'recast';
import * as acorn from 'acorn';

// TODO maybe add an option to not use recast (useful in testing and serialisation? Or just silly?)
export default function parse(source: string) {
  // This is copied from v1 but I am unsure the usecase
  const escaped = source.replace(/\ $/, '');
  
  const ast = recast.parse(escaped, {
    tolerant: true,
    range: true,
    parser: {
      parse: (source: string) =>
        acorn.parse(source, {
          sourceType: 'module', // Note: this is different to v1 (but back compatible I think)
          ecmaVersion: 10,
          allowHashBang: true,
          locations: true,
        })
    },
  });

  // Recast with Acorn doesn't have an initial errors array.
  if (!ast.program.errors) {
    ast.program.errors = [];
  }

  return ast;
}