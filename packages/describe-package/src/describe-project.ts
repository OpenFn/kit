import type { Project } from './typescript/project';
import type { FunctionDescription, ParameterDescription } from './api';
import { WrappedSymbol } from './typescript/wrapped-symbol';

type DescribeOptions = {
  allowEmptyDesc?: boolean; // defaults to false
};

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
  // If this is a non native symbol, say where it came from
  let parent = undefined;
  // @ts-ignore symbol.parent
  const parentSymbol = symbol.symbol.parent;
  if (parentSymbol && parentSymbol.escapedName.match(/^\"\/node_modules\//)) {
    [parent] = parentSymbol.escapedName.match(/(language-\w+)/);
  }
  return {
    name: moduleName ? `${moduleName}.${symbol.name}` : symbol.name,
    description: symbol.comment,
    parameters: symbol.parameters.map((p) => describeParameter(project, p)),
    magic: false,
    isOperation: false,
    examples: symbol.examples,
    parent,
  };
};

// Describe the exported functions of a given d.ts file in a project
const describeProject = (
  project: Project,
  typesEntry: string = 'index.d.ts',
  options: DescribeOptions = {}
) => {
  const sourceFile = project.getSourceFile(typesEntry);

  if (!sourceFile) {
    throw new Error(`Couldn't find a SourceFile for: ${typesEntry}`);
  }

  return project.getSymbol(sourceFile).exports.reduce((symbols, symbol) => {
    if (
      (symbol.isFunctionDeclaration && options.allowEmptyDesc) ||
      symbol.comment
    ) {
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
  }, [] as FunctionDescription[]);
};

export default describeProject;
