import test from 'ava';
import { LocalStorage } from 'node-localstorage';
global.localStorage = new LocalStorage('./tmp');
import { readFile } from 'node:fs/promises';
import { Project, getDefaultMap } from '../../src/typescript/project';
import { createDefaultMapFromNodeModules } from '@typescript/vfs';
import {
  fetchFile,
  fetchFileListing,
  fetchDTSListing,
} from '../../src/fs/package-fs';
import { getDtsFixture, setupProject } from '../helpers';

test('fetch from the local filesystem', async (t) => {
  t.timeout(8000);
  const adaptorName = '@openfn/language-common@2.0.0-rc1';

  const fsMap = new Map();
  fsMap.set(
    `/node_modules/@openfn/language-common/package.json`,
    await fetchFile(`${adaptorName}/package.json`)
  );

  for await (const file of fetchDTSListing(adaptorName)) {
    fsMap.set(
      `/node_modules/@openfn/language-common${file}`,
      await fetchFile(`${adaptorName}${file}`)
    );
  }

  const filePaths = Array.from(fsMap.keys());

  t.deepEqual(filePaths, [
    '/node_modules/@openfn/language-common/package.json',
    '/node_modules/@openfn/language-common/dist/language-common.d.ts',
  ]);

  const projectFsMap: Map<string, string> = new Map([
    ...(await createDefaultMapFromNodeModules(Project.compilerOpts)),
  ]);

  const project = new Project(projectFsMap);

  for (const [path, content] of fsMap) {
    project.addToFS(content, path);
  }

  project.createFile(
    [
      "import {execute} from '@openfn/language-common';",
      'execute(1)',
      'clgs.log()',
    ].join('\n'),
    '/src/index.ts'
  );

  t.deepEqual(
    project.formatDiagnostics(project.getSourceFile('/src/index.ts')),
    [
      "/src/index.ts (2,9): Argument of type 'number' is not assignable to parameter of type 'Operation<State | Promise<State>>'.",
      "/src/index.ts (3,1): Cannot find name 'clgs'.",
    ]
  );
});

test('addToFS', (t) => {
  const project = new Project(new Map([['foo', '']]));
  project.addToFS(new Map([['bar', '']]));

  t.deepEqual(
    project.fsMap,
    new Map([
      ['foo', ''],
      ['bar', ''],
    ])
  );
});

test('getSymbol handles export aliases', async (t) => {
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

test('getSymbol handles export declarations', async (t) => {
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

// TODO this is unfinished
// "get" a package
// look at it's package.json for typings
// get the files referred to by its types

async function getAdaptor(path: string): Promise<Map<string, string>> {
  const fsMap: Map<string, string> = new Map();

  const packageJson = await readFile(path + '/package.json', 'utf8');
  const packageDetails = JSON.parse(packageJson);

  const packageMapPrefix: string = `/node_modules/${packageDetails.name}`;
  fsMap.set(`${packageMapPrefix}/package.json`, packageJson);

  const typesPath: string = packageDetails['types'];

  const typesContent: string = await readFile(`${path}/${typesPath}`, 'utf8');

  fsMap.set(`${packageMapPrefix}/${typesPath}`, typesContent);

  return fsMap;
}

function createAdaptorMap(): Map<string, string> {
  let map = new Map();
  return map;
}

test.skip('builds a map for a given adaptor', (t) => {
  const fsMap = createAdaptorMap();
  t.is(fsMap.size, 0);
});
