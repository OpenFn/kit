import type { Project } from './typescript/project';
import type { FunctionDescription, ParameterDescription } from './api';
import { WrappedSymbol } from './typescript/wrapped-symbol';

type DescribeOptions = {
  // Should we describe privately declared exports?
  // Not that export alises are all considered public
  includePrivate?: boolean; // defaults to false
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
  let parent = undefined;
  // If this is an export alias (exported from another package) say where it came from
  if (symbol.isExportAlias) {
    // @ts-ignore symbol.parent
    [parent] = symbol.symbol.parent.escapedName.match(/(language-\w+)/);
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

  return project
    .getSymbol(sourceFile)
    .exports.filter((symbol) => {
      if (options.includePrivate) {
        // return everything if we want private members
        return true;
      }
      // Return all export aliases and public symbols
      return symbol.isExportAlias || symbol.isPublic;
    })
    .reduce((symbols, symbol) => {
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
    }, [] as FunctionDescription[]);
};

export default describeProject;
