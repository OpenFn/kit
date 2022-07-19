import { describe } from "mocha";
import { assert } from "chai";
import { ModuleThread, spawn, Thread, BlobWorker } from "threads";
import { WorkerAPI } from "../src/worker/worker";
import { getDtsFixture } from "./helpers";
import { build } from "esbuild";

const exampleDts = await getDtsFixture("language-common");

/**
 * Working around compilation issues with Threadjs and bundling it for nodejs.
 * There is some dynamic requires that switch between the nodejs and the browser
 * Worker implementations that appears to either not bundle the nodejs implementation
 * or doesn't correctly export it during runtime.
 */
async function buildAsString(filename) {
  let result = await build({
    entryPoints: [filename],
    sourcemap: "inline",
    bundle: true,
    format: "esm",
    target: ["es2020"],
    platform: "node",
    write: false,
    outdir: "out",
    // Optional, appears to work without excluding node modules.
    external: ["node_modules/*"],
  });

  return result.outputFiles[0].contents;
}


describe("worker", () => {
  let compiledBlob;

  before(async function() {
    this.timeout(5000)
    compiledBlob = await buildAsString("src/worker/worker.ts");
  });

  describe("describeAdaptor", () => {
    it("creates and describes a dts file", async () => {
      const blobWorker = new BlobWorker(compiledBlob);
      const worker = await spawn<WorkerAPI>(blobWorker);

      try {
        await worker.createProject();
        assert.ok(await worker.createProject());

        const adaptorExports = await worker.describeAdaptor(exampleDts);

        assert.ok(adaptorExports.find((sym) => sym.name == "execute"));
        assert.ok(!adaptorExports.find((sym) => sym.name == "DataSource"));

        return Thread.terminate(worker);
      } catch (error) {
        if (worker) Thread.terminate(worker);
        throw error;
      }
    }).timeout(8000);
  });

  describe("loadModule", () => {
    it("can load a module", async function () {
      const blobWorker = new BlobWorker(compiledBlob);
      const worker = await spawn<WorkerAPI>(blobWorker);

      try {
        await worker.createProject();
        await worker.loadModule("@openfn/language-common@2.0.0-rc1");

        const adaptorExports = await worker.describeDts(
          "/node_modules/@openfn/language-common/dist/language-common.d.ts"
        );
        assert.ok(adaptorExports.find((sym) => sym.name == "execute"));
        assert.ok(!adaptorExports.find((sym) => sym.name == "DataSource"));

        await Thread.terminate(worker);
      } catch (e) {
        await Thread.terminate(worker);
        throw e;
      }
    }).timeout(20000);
  });

  // HACK: Worker threads seem to prevent Mocha from exiting
  afterEach(function () {
    if (this.currentTest!.state == "failed") {
      setTimeout(() => process.exit(1), 500);
    }
  });
});
