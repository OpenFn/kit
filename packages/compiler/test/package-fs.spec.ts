import { assert } from "chai";
import { fetchDTSListing, fetchFile, flattenFiles } from "../src/package-fs";

describe("flattenFiles", () => {
  it('should flatten a file list', async() => {
    const listing = {
      "path": "a",
      "type": "directory",
      "files": [
        { "path": "node_modules", "type": "directory", "files": [
          { "path": "/node_modules/x.js", "type": "file" },
        ]},
        { "path": "lib", "type": "directory", "files": [
          { "path": "/lib/y.js", "type": "file" },
        ]},
        { "path": "/a.js", "type": "file" }
      ]
    };
    const results: string[] = [];
    for await (const f of flattenFiles(listing)) {
      results.push(f);
    }
    assert.deepEqual(results.length, 3)
    assert.include(results, '/node_modules/x.js');
    assert.include(results, '/lib/y.js');
    assert.include(results, '/a.js');
  });

  it('should flatten a file list ignore node_modules', async() => {
    const listing = {
      "path": "a",
      "type": "directory",
      "files": [
        { "path": "/node_modules", "type": "directory", "files": [
          { "path": "/node_modules/x.js", "type": "file" },
        ]},
        { "path": "lib", "type": "directory", "files": [
          { "path": "/lib/y.js", "type": "file" },
        ]},
        { "path": "/a.js", "type": "file" }
      ]
    };
    const results: string[] = [];
    for await (const f of flattenFiles(listing, true)) {
      results.push(f);
    }
    assert.deepEqual(results.length, 2)
    assert.include(results, '/lib/y.js');
    assert.include(results, '/a.js');
  });

});

describe("fetchDTS", () => {
  it("can get a list of .d.ts files for a given package", async () => {
    const results: string[] = [];
    for await (const f of fetchDTSListing("@typescript/vfs")) {
      results.push(f);
    }

    assert.deepEqual(results, ['/dist/index.d.ts'])
  }).timeout(20000);
});

describe("fetchFile", () => {
  it("can retrieve a file for a given package", async () => {
    const result = await fetchFile("@typescript/vfs/dist/index.d.ts")

    assert.ok(result)
  });
});
