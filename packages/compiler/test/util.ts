import fs from 'node:fs';
import path from 'node:path';

export const loadAst = (name: string) => fs.readFileSync(
  path.resolve(`test/asts/${name}.json`),
  'utf8'
);