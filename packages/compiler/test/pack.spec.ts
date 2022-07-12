import { describe } from "mocha";
import { assert } from "chai";
import { Pack } from "../src/pack";

describe("Pack", () => {
  describe("fromUnpkg", () => {
    it("resolves the specifier after getting the package.json", async () => {
      const pack = await Pack.fromUnpkg("@openfn/language-common");
      assert.equal(pack.path, "@openfn/language-common");
      assert.equal(pack.specifier, "@openfn/language-common@1.7.3");
    }).timeout(20000);

    it("it loads the file listing", async () => {
      const pack = await Pack.fromUnpkg("@openfn/language-common@2.0.0-rc1");
      assert.equal(pack.path, "@openfn/language-common@2.0.0-rc1");
      assert.deepEqual(pack.fileListing, [
        "/LICENSE",
        "/dist/index.cjs",
        "/dist/index.js",
        "/dist/language-common.d.ts",
        "/package.json",
        "/LICENSE.LESSER",
        "/README.md",
      ]);

      assert.equal(pack.fsMap.size, 0)
      await pack.getFiles();
      assert.equal(pack.fsMap.size, 7)
      
    }).timeout(20000);
  });
});
