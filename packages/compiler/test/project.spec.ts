import { assert } from "chai";
import { LocalStorage } from "node-localstorage";
global.localStorage = new LocalStorage("./tmp");
import { readFile } from "fs/promises";
import { Project, getDefaultMap } from "../src/project";
import { createDefaultMapFromNodeModules } from "@typescript/vfs";
import {
  fetchFile,
  fetchFileListing,
  fetchDTSListing,
} from "../src/package-fs";

// "get" a package
// look at it's package.json for typings
// get the files referred to by it's types

async function getAdaptor(path: string): Promise<Map<string, string>> {
  const fsMap: Map<string, string> = new Map();

  const packageJson = await readFile(path + "/package.json", "utf8");
  const packageDetails = JSON.parse(packageJson);

  const packageMapPrefix: string = `/node_modules/${packageDetails.name}`;
  fsMap.set(`${packageMapPrefix}/package.json`, packageJson);

  const typesPath: string = packageDetails["types"];

  const typesContent: string = await readFile(`${path}/${typesPath}`, "utf8");

  fsMap.set(`${packageMapPrefix}/${typesPath}`, typesContent);

  return fsMap;
}

function createAdaptorMap(): Map<string, string> {
  let map = new Map();
  return map;
}

describe("Adaptor FS maps", () => {
  it("builds a map for a given adaptor", () => {
    const fsMap = createAdaptorMap();
    assert.equal(fsMap.size, 0);
  });
});

describe("Project", () => {
  describe("constructor", () => {
    it("can fetch from the local filesystem", async () => {
      const adaptorName = "@openfn/language-common@2.0.0-rc1";

      const fsMap = new Map();
      fsMap.set(
        `/node_modules/@openfn/language-common/package.json`,
        await fetchFile(`${adaptorName}/package.json`)
      );

      for await (const file of fetchDTSListing(adaptorName)) {
        fsMap.set(
          `/node_modules/@openfn/language-common${file}`,
          await fetchFile(`${adaptorName}${file}`)
        );
      }

      const filePaths = Array.from(fsMap.keys());

      assert.deepEqual(filePaths, [
        "/node_modules/@openfn/language-common/package.json",
        "/node_modules/@openfn/language-common/dist/language-common.d.ts",
      ]);

      const projectFsMap: Map<string, string> = new Map([
        ...(await createDefaultMapFromNodeModules(Project.compilerOpts)),
      ]);

      const project = new Project(projectFsMap);

      for (const [path, content] of fsMap) {
        project.addToFS(content, path);
      }

      project.createFile(
        [
          "import {execute} from '@openfn/language-common';",
          "execute(1)",
          "clgs.log()",
        ].join("\n"),
        "/src/index.ts"
      );

      assert.deepEqual(
        project.formatDiagnostics(project.getSourceFile("/src/index.ts")),
        [
          "/src/index.ts (2,9): Argument of type 'number' is not assignable to parameter of type 'Operation<State | Promise<State>>'.",
          "/src/index.ts (3,1): Cannot find name 'clgs'.",
        ]
      );
    }).timeout(8000);
  });

  describe("addToFS", () => {
    const project = new Project(new Map([["foo", ""]]));
    project.addToFS(new Map([["bar", ""]]));

    assert.deepEqual(
      project.fsMap,
      new Map([
        ["foo", ""],
        ["bar", ""],
      ])
    );
  });
});
