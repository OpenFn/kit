// should parse some js
// These unit tests are a basic exercising of the API (and CLI) and a bit of documentation too
// We can also parse the job DSL code just to sanity check its valid JS
import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import parse from '../src/parse';

const loadAst = (name: string) => fs.readFileSync(path.resolve(`test/asts/${name}.json`), 'utf8');

test('parse a simple statement', (t) => {
  const source = "const x = 10;";

  const ast = loadAst('simple-statement');
  const result = parse(source);
  t.assert(ast === JSON.stringify(result));
});

test('parse an esm module', (t) => {
  const source = `import foo from 'bar'; export const x = 10;`;
  const ast = loadAst('esm');
  const result = parse(source);
  t.assert(ast === JSON.stringify(result));
});

// This will still parse as a module, but it won't freak out when it see module.exports
test('parse a CJS script', (t) => {
  const source = `module.exports = 10;`;
  const ast = loadAst('cjs');
  const result = parse(source);
  t.assert(ast === JSON.stringify(result));
});
