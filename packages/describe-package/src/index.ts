import type { Project } from "./project";
export { Project } from "./project";
export { Pack } from "./pack";
export * from './package-fs';

type FunctionDescription = {
  name: string;
  comment: string;
};

export function describeDts(project: Project, path: string = "index.d.ts") {
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
