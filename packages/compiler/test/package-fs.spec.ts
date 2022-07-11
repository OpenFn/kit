import { assert } from "chai";
import { fetchDTS, fetchFile } from "../src/package-fs";

describe("fetchFileListing", () => {
  it("can call the api from a worker", async () => {
    const results: string[] = [];
    for await (const f of fetchDTS("@typescript/vfs")) {
      results.push(f);
    }

    assert.deepEqual(results, ['/dist/index.d.ts'])
  });
});
