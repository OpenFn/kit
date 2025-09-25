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
import { namedTypes } from 'ast-types';
import { heap } from './util';

type Options = {
  /** Name of the source job (no file extension). This triggers source map generation */
  name?: string;
  trace?: boolean;
};

export default function parse(
  source: string,
  options: Options = {}
): namedTypes.File {
  // This is copied from v1 but I am unsure the use-case
  const escaped = source.replace(/\ $/, '');

  if (options.trace) {
    heap('pre acorn parse');
  }

  const ast = recast.parse(escaped, {
    sourceFileName: options.name && `${options.name}.js`,
    tolerant: true,
    range: true,
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

  if (options.trace) {
    heap('post acorn parse');
  }

  // Recast with Acorn doesn't have an initial errors array
  if (!ast.program.errors) {
    ast.program.errors = [];
  }

  return ast;
}

// Simplified parse with no location info
export const simpleParse = (source: string) =>
  acorn.parse(source, {
    sourceType: 'module',
    ecmaVersion: 10,
    locations: false,
  });
