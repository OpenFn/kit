import type { Project } from './typescript/project';

type FunctionDescription = {
  name: string;
  comment: string;
};

// Given a Project, describe it from the entry point
const describeProject = (
  project: Project,
  typesEntry: string = 'index.d.ts'
) => {
  const sourceFile = project.getSourceFile(typesEntry);

  if (!sourceFile) {
    throw new Error(`Couldn't find a SourceFile for: ${typesEntry}`);
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
};

export default describeProject;
