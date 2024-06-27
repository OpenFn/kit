import { WrappedSymbol } from './typescript/wrapped-symbol';
import { NO_SYMBOLS_FOUND } from './typescript/project';
import type { Project } from './typescript/project';
import type {
  FunctionDescription,
  ParameterDescription,
  NamespaceDescription,
} from './api';

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

const describeNamespace = (
  _project: Project,
  symbol: WrappedSymbol
): NamespaceDescription => {
  return {
    name: symbol.name,
    type: 'namespace',
  };
};

const describeFunction = (
  project: Project,
  symbol: WrappedSymbol,
  moduleName?: string
): FunctionDescription => {
  return {
    type: 'function',
    name: moduleName ? `${moduleName}.${symbol.name}` : symbol.name,
    description: symbol.comment,
    parameters: symbol.parameters.map((p) => describeParameter(project, p)),
    magic: symbol.jsDocTags.some((tag) => tag.tagName.escapedText === 'magic'),
    isOperation: false,
    examples: symbol.examples.map((eg: string) => {
      if (eg.startsWith('<caption>')) {
        let [caption, code] = eg.split('</caption>');
        caption = caption.replace('<caption>', '');

        return { caption: caption.trim(), code: code.trim() };
      }
      return { code: eg.trim() };
    }),
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

  let symbols;
  try {
    symbols = project.getSymbol(sourceFile);
  } catch (e: any) {
    if ((e.messsage = NO_SYMBOLS_FOUND)) {
      symbols = { exports: [] };
    } else {
      throw e;
    }
  }
  return symbols.exports
    .filter((symbol) => {
      if (options.includePrivate) {
        // return everything if we want private members
        return true;
      }
      // Return all export aliases and public symbols
      return symbol.isExportAlias || symbol.hasFunctionTag;
    })
    .reduce((symbols, symbol) => {
      if (symbol.isFunctionDeclaration) {
        symbols.push(describeFunction(project, symbol));
      } else if (symbol.isModuleDeclaration) {
        symbol.exports.map((modSymbol) => {
          if (modSymbol.isFunctionDeclaration) {
            symbols.push(describeFunction(project, modSymbol, symbol.name));
          }
        });
      } else if (symbol.isExportAlias) {
        symbols.push(describeNamespace(project, symbol));
      }

      return symbols;
    }, [] as Array<FunctionDescription | NamespaceDescription>);
};

export default describeProject;
