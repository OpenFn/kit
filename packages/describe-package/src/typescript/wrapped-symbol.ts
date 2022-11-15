import ts from 'typescript';

export class WrappedSymbol {
  typeChecker: ts.TypeChecker;
  symbol: ts.Symbol;
  constructor(typeChecker: ts.TypeChecker, symbol: ts.Symbol) {
    this.typeChecker = typeChecker;
    this.symbol = symbol;
  }

  public get isFunctionDeclaration(): boolean {
    if (this.symbol.valueDeclaration) {
      return ts.isFunctionDeclaration(this.symbol.valueDeclaration);
    }

    return false;
  }

  public get isModuleDeclaration(): boolean {
    if (this.symbol.valueDeclaration) {
      return ts.isModuleDeclaration(this.symbol.valueDeclaration);
    }

    return false;
  }

  public get exports(): WrappedSymbol[] {
    const exports: WrappedSymbol[] = [];

    if (this.symbol.exports) {
      this.symbol.exports.forEach((sym, _) => {
        exports.push(
          new WrappedSymbol(this.typeChecker, sym).aliasedSymbolIfNecessary
        );
      });
    }

    return exports;
  }

  public get aliasedSymbolIfNecessary(): WrappedSymbol {
    if ((this.symbol.flags & ts.SymbolFlags.Alias) !== 0) {
      const newSymbol: ts.Symbol = this.typeChecker.getAliasedSymbol(
        this.symbol
      );
      return new WrappedSymbol(this.typeChecker, newSymbol);
    }
    return this;
  }

  public get comment(): string {
    return ts.displayPartsToString(
      this.symbol.getDocumentationComment(this.typeChecker)
    );
  }

  public get name(): string {
    return this.symbol.getName();
  }

  public get parameters(): WrappedSymbol[] {
    if (this.symbol.valueDeclaration) {
      // @ts-ignore
      return this.symbol.valueDeclaration.parameters.map(
        (param: any) => new WrappedSymbol(this.typeChecker, param.symbol)
      );
    }
    return [];
  }

  public get examples(): string[] {
    const examples = [];
    // @ts-ignore
    const jsdoc = this.symbol.valueDeclaration?.jsDoc;
    if (jsdoc) {
      for (const d of jsdoc) {
        examples.push(
          ...d.tags
            .filter((tag: ts.JSDocTag) => tag.tagName.escapedText === 'example')
            .map((tag: ts.JSDocTag) => tag.comment)
        );
      }
    }
    return examples;
  }

  public get type(): ts.TypeNode {
    // This works for parameters but how generic is it?
    // @ts-ignore
    return this.symbol.valueDeclaration?.type;
  }

  // public get typeString(): NodeObject {
  //   const type = this.typeChecker.getDeclaredTypeOfSymbol(
  //     this.symbol.declarations[0]
  //   );
  //   console.log(' > ', type.intrinsicName);
  //   return this.typeChecker.typeToString(type);
  // }
}

// interface DocEntry {
//   name?: string;
//   fileName?: string;
//   documentation?: string;
//   type?: string;
//   constructors?: DocEntry[];
//   parameters?: DocEntry[];
//   returnType?: string;
// }
