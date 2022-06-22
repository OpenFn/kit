import assert from "assert";
import { ModuleThread, spawn, Thread, BlobWorker } from "threads";
import { WorkerAPI } from "../src/worker/worker";
import { getDtsFixture } from "./helpers";
import { buildSync } from "esbuild";

const exampleDts = await getDtsFixture("language-common");

/**
 * Working around compilation issues with Threadjs and bundling it for nodejs.
 * There is some dynamic requires that switch between the nodejs and the browser
 * Worker implementations that appears to either not bundle the nodejs implementation
 * or doesn't correctly export it during runtime.
 */
function buildAsString(filename) {
  let result = buildSync({
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

it("can call the api from a worker", async () => {
  let worker: ModuleThread<WorkerAPI>;

  try {
    worker = await spawn<WorkerAPI>(
      new BlobWorker(buildAsString("src/worker/worker.ts"))
    );
    await worker.createProject();
    assert((await worker.createProject()) == true);

    const adaptorExports = await worker.describeAdaptor(exampleDts);

    assert(adaptorExports.find((sym) => sym.name == "execute"));
    assert(!adaptorExports.find((sym) => sym.name == "DataSource"));
    return Thread.terminate(worker);
  } catch (error) {
    console.log(error);

    assert(!error, error);
  }
});
