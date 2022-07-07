import { assert } from "chai";
import { Project } from "../src/compiler";
import { getDtsFixture } from "./helpers";

describe("getExports", () => {
  it("for export aliases", async () => {
    const exampleDts = await getDtsFixture("language-common.export-alias");
    const p = new Project();
    p.createFile(exampleDts, "index.d.ts");

    const sourceFile = p.getSourceFile("index.d.ts")!;

    const syms = p
      .getSymbol(sourceFile)
      .exports.filter((sym) => sym.isFunctionDeclaration);

    assert.isOk(syms.find((sym) => sym.name == "execute"));
    assert.isOk(!syms.find((sym) => sym.name == "DataSource"));
  });

  it("for export declarations", async () => {
    const exampleDts = await getDtsFixture("language-common");
    const p = new Project();
    p.createFile(exampleDts, "index.d.ts");

    const sourceFile = p.getSourceFile("index.d.ts")!;

    const symbols = p
      .getSymbol(sourceFile)
      .exports.filter(
        (sym) => sym.isModuleDeclaration || sym.isFunctionDeclaration
      );

    const httpModuleDeclaration = symbols.find((sym) => sym.name == "http");

    assert.isOk(httpModuleDeclaration);
    assert.equal(httpModuleDeclaration!.exports.length, 9);

    assert.isOk(symbols.find((sym) => sym.name == "execute"));
    assert.isOk(!symbols.find((sym) => sym.name == "DataSource"));
  });
});
