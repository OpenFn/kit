/**
 * Parse a source string as an ESM module and return an AST representation
 */
import * as acorn from 'acorn';

export default function parse(source: string) {
  return acorn.parse(source, {
    sourceType: 'module', // Note: this is different to v1 (but back compatible I think)
    ecmaVersion: 10,
    allowHashBang: true,
    locations: true,
  });
}