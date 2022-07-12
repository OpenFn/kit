import { build } from "esbuild";
import path from "path";
import { readFile } from "fs/promises";

export default function rawPlugin() {
  return {
    name: "raw",
    setup(build) {
      build.onResolve({ filter: /\?raw$/ }, (args) => {
        return {
          path: path.isAbsolute(args.path)
            ? args.path
            : path.join(args.resolveDir, args.path),
          namespace: "raw-loader",
        };
      });
      build.onLoad(
        { filter: /\?raw$/, namespace: "raw-loader" },
        async (args) => {
          return {
            contents: await readFile(args.path.replace(/\?raw$/, "")),
            loader: "text",
          };
        }
      );
    },
  };
}

function showUsage() {
  console.log("USAGE");
  console.log("node esbuild.js watch"); // build and serve dev files
  console.log("node esbuild.js dev"); // build dev files
  console.log("node esbuild.js prod"); // build for production
  process.exit(0);
}

if (process.argv.length < 3) {
  showUsage();
}

if (!["dev", "watch", "prod"].includes(process.argv[2])) {
  showUsage();
}

// production mode, or not
const production = process.argv[2] === "prod";

// esbuild watch in dev mode to rebuild out files
const watchOptions = {
  onRebuild(error) {
    if (error)
      console.error("esbuild: Watch build failed:", error.getMessage());
    else console.log("esbuild: Watch build succeeded");
  },
};

let watch = process.argv[2] === "watch" ? watchOptions : false;

const commonBuildOptions = {
  bundle: true,
  write: true,
  watch,
  format: "esm",
  target: ["es2020"],
  outdir: "./dist",
  external: ["fs", "events", "stream", "path", "util", "constants", "assert"],
  pure: ["console.log", "console.time", "console.timeEnd"],
};

try {
  /**
   * WebWorker internals modules
   * This is the bundle that includes the Worker, Typescript and the interface
   * to query and interact with the Compiler. In order to provide a single file
   * for using the library we build just the worker, and later inject it into
   * the Worker entrypoint.
   */
  await build({
    ...commonBuildOptions,
    entryPoints: {
      "worker-internals": "./src/worker/worker.ts",
    },
    format: "esm",
    minify: true,
  });

  /**
   * WebWorker Entrypoint
   * This is the one that actually gets used in the browser, note the `rawPlugin`
   * which will load in the output of the `worker-internals` file as a string
   * into the entrypoint - allowing us to bundle both the worker code and the
   * entrypoint in the same file.
   */
  await build({
    ...commonBuildOptions,
    entryPoints: {
      worker: "./src/worker/index.ts",
    },
    format: "esm",
    minify: false,
    plugins: [rawPlugin()],
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
