import test from 'ava';
import { describeDts } from '../src';
import { Project } from '../src/typescript/project';
import { getDtsFixture, setupProject } from './helpers';

test('describe exported functions', async (t) => {
  const project = await setupProject('export-fns');
  const exports = await describeDts(project);

  t.assert(exports.find(({ name }) => name === 'fn1'));
  t.assert(exports.find(({ name }) => name === 'fn2'));
});

// TODO this doesn't work at the moment
test.skip('export default object', async (t) => {
  const project = await setupProject('export-default-obj');
  const exports = await describeDts(project);

  t.assert(exports.find(({ name }) => name === 'default'));
});

test('handles export aliases', async (t) => {
  const exampleDts = await getDtsFixture('language-common.export-alias');
  const p = new Project();
  p.createFile(exampleDts, 'index.d.ts');

  const sourceFile = p.getSourceFile('index.d.ts')!;

  const syms = p
    .getSymbol(sourceFile)
    .exports.filter((sym) => sym.isFunctionDeclaration);

  t.assert(syms.find((sym) => sym.name == 'execute'));
  t.assert(!syms.find((sym) => sym.name == 'DataSource'));
});

test('handles export declarations', async (t) => {
  const exampleDts = await getDtsFixture('language-common');
  const p = new Project();
  p.createFile(exampleDts, 'index.d.ts');

  const sourceFile = p.getSourceFile('index.d.ts')!;

  const symbols = p
    .getSymbol(sourceFile)
    .exports.filter(
      (sym) => sym.isModuleDeclaration || sym.isFunctionDeclaration
    );

  const httpModuleDeclaration = symbols.find((sym) => sym.name == 'http');

  t.assert(httpModuleDeclaration);
  t.is(httpModuleDeclaration!.exports.length, 9);

  t.assert(symbols.find((sym) => sym.name == 'execute'));
  t.assert(!symbols.find((sym) => sym.name == 'DataSource'));
});
