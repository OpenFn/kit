import assert from "assert";
import { Project } from "../src/compiler";
import { getDtsFixture } from "./helpers";

describe("getExports", () => {
  it("for export aliases", async () => {
    const exampleDts = await getDtsFixture("language-common.export-alias");
    const p = new Project();
    p.addFile(exampleDts, "index.d.ts");

    const sourceFile = p.getSourceFile("index.d.ts")!;

    const syms = p
      .getSymbol(sourceFile)
      .exports.filter((sym) => sym.isFunctionDeclaration);

    assert(syms.find((sym) => sym.name == "execute"));
    assert(!syms.find((sym) => sym.name == "DataSource"));
  });

  it("for export declarations", async () => {
    const exampleDts = await getDtsFixture("language-common");
    const p = new Project();
    p.addFile(exampleDts, "index.d.ts");

    const sourceFile = p.getSourceFile("index.d.ts")!;

    const symbols = p
      .getSymbol(sourceFile)
      .exports.filter(
        (sym) => sym.isModuleDeclaration || sym.isFunctionDeclaration
      );

    const httpModuleDeclaration = symbols.find((sym) => sym.name == "http");
    
    assert(httpModuleDeclaration);
    assert(httpModuleDeclaration.exports.length == 9);

    assert(symbols.find((sym) => sym.name == "execute"));
    assert(!symbols.find((sym) => sym.name == "DataSource"));
  });
});
