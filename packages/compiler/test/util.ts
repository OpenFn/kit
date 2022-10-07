import fs from 'node:fs';
import path from 'node:path';
import { ExecutionContext } from 'ava';
import { namedTypes } from 'ast-types';
import { print } from 'recast';

export const loadAst = (name: string): string =>
  fs.readFileSync(path.resolve(`test/asts/${name}.json`), 'utf8') as string;

// Ensure the code of two asts is equal
export const assertCodeEqual = (
  t: ExecutionContext,
  a: namedTypes.Node,
  b: namedTypes.Node
) => {
  t.assert(print(a).code === print(b).code);
};
