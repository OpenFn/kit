import type { Project } from './typescript/project';
import type { FunctionDescription, ParameterDescription } from './api';
import { WrappedSymbol } from './typescript/wrapped-symbol';

const describeParameter = (
  project: Project,
  symbol: WrappedSymbol
): ParameterDescription => {
  const typeNode = project.typeChecker.getTypeFromTypeNode(symbol.type);
  const typeString = project.typeChecker.typeToString(typeNode);
  return {
    name: symbol.name,
    optional: false,
    type: typeString,
  };
};

const describeFunction = (
  project: Project,
  symbol: WrappedSymbol,
  moduleName?: string
): FunctionDescription => {
  return {
    name: moduleName ? `${moduleName}.${symbol.name}` : symbol.name,
    description: symbol.comment,
    parameters: symbol.parameters.map((p) => describeParameter(project, p)),
    magic: false,
    isOperation: false,
  };
};

// Describe the exported functions of a given d.ts file in a project
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
      symbols.push(describeFunction(project, symbol));
    }

    if (symbol.isModuleDeclaration) {
      symbol.exports.map((modSymbol) => {
        if (modSymbol.isFunctionDeclaration) {
          symbols.push(describeFunction(project, modSymbol, symbol.name));
        }
      });
    }

    return symbols;
  }, [] as Partial<FunctionDescription>[]);
};

export default describeProject;
