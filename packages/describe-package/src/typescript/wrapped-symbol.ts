import ts from "typescript";

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
