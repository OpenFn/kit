import { assert } from "chai";
import { fetchDTSListing, fetchFile } from "../src/package-fs";

describe("fetchDTS", () => {
  it("can get a list of .d.ts files for a given package", async () => {
    const results: string[] = [];
    for await (const f of fetchDTSListing("@typescript/vfs")) {
      results.push(f);
    }

    assert.deepEqual(results, ['/dist/index.d.ts'])
  });
});

describe("fetchFile", () => {
  it("can retrieve a file for a given package", async () => {
    const result = await fetchFile("@typescript/vfs/dist/index.d.ts")

    assert.ok(result)
  });
});
