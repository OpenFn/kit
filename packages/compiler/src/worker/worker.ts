import { expose } from "threads/worker";
import { Project } from "../compiler";
import { fetchDTS, fetchFile } from "../package-fs";

let project: undefined | Project;

type FunctionDescription = {
  name: string;
  comment: string;
};

function createProject() {
  project = new Project();
  return true;
}

function describeAdaptor(dts: string) {
  if (!project) {
    throw new Error("Project not initialized, call `createProject` first.");
  }

  project.createFile(dts, "index.d.ts");
  const sourceFile = project.getSourceFile("index.d.ts")!;

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

async function fetchDTSForPackage(packageName: string) {
  const results = new Map<string, string>();
  for await (const path of fetchDTS(packageName)) {
    const fullPath = `${packageName}${path}`;
    const contents = await fetchFile(fullPath);
    results.set(`${packageName}${path}`, contents);
  }

  return results;
}

const workerApi = {
  createProject,
  describeAdaptor,
  fetchDTSForPackage,
  fetchFile,
};
export type WorkerAPI = typeof workerApi;

expose(workerApi);
