import { expose } from 'threads/worker';
import { Project } from '../typescript/project';
import { fetchFile } from '../fs/package-fs';
import { Pack } from '../pack';

let project: undefined | Project;

export type FunctionDescription = {
  name: string;
  comment: string;
};

function createProject() {
  if (!process) {
    throw Error('This worker does not work in browsers currently :(');
  }
  project = new Project();
  return true;
}

const packageOrDts = /(?:package.json)|(?:\.d\.ts$)/i;

/**
 * Loads a module from Unpkg and adds the `.d.ts` file to the
 * project for inspection.
 * @param specifier string
 */
async function loadModule(specifier: string) {
  if (!project) {
    throw new Error('Project not initialized, call `createProject` first.');
  }

  const pack = await Pack.fetch(specifier);

  if (!pack.types)
    throw new Error(
      `Package does not have a 'types' property: ${pack.specifier}`
    );

  const files = await pack.getFiles(
    pack.fileListing.filter((path) => packageOrDts.test(path))
  );

  project.addToFS(files);
  project.createFile(files.get(pack.types)!, pack.types);

  // TODO: return serializable Pack so the consumer
  // knows where to find particular files
  return true;
}

function describeDts(path: string) {
  if (!project) {
    throw new Error('Project not initialized, call `createProject` first.');
  }

  const sourceFile = project.getSourceFile(path);

  if (!sourceFile) {
    throw new Error(`Couldn't find a SourceFile for: ${path}`);
  }

  return project.getSymbol(sourceFile).exports.reduce((symbols, symbol) => {
    if (symbol.isFunctionDeclaration) {
      symbols.push({
        name: symbol.name,
        comment: symbol.comment,
      });
    }

    if (symbol.isModuleDeclaration) {
      symbol.exports.map((modSymbol) => {
        if (modSymbol.isFunctionDeclaration) {
          symbols.push({
            name: `${symbol.name}.${modSymbol.name}`,
            comment: modSymbol.comment,
          });
        }
      });
    }

    return symbols;
  }, [] as FunctionDescription[]);
}

function describeAdaptor(dts: string) {
  if (!project) {
    throw new Error('Project not initialized, call `createProject` first.');
  }

  project.createFile(dts, 'index.d.ts');
  return describeDts('index.d.ts');
}

const workerApi = {
  createProject,
  describeAdaptor,
  fetchFile,
  loadModule,
  describeDts,
};
export type WorkerAPI = typeof workerApi;

expose(workerApi);
