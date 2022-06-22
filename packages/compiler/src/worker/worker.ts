import { expose } from "threads/worker";
import { Project } from "../compiler";

let project: undefined | Project;

type FunctionDescription = {
  name: string;
  comment: string;
}

const workerApi = {
  createProject() {
    project = new Project();
    return true;
  },
  describeAdaptor(dts: string) {
    if (!project) {
      throw new Error("Project not initialized, call `createProject` first.");
    }

    project.addFile(dts, "index.d.ts");
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
  },
};
export type WorkerAPI = typeof workerApi;

expose(workerApi);
