import { build } from 'esbuild';
import path from 'path';
import { readFile, rm } from 'fs/promises';
import { BuildOptions } from 'esbuild';

export default function rawPlugin() {
  return {
    name: 'raw',
    setup(build) {
      build.onResolve({ filter: /\?raw$/ }, (args) => {
        return {
          path: path.isAbsolute(args.path)
            ? args.path
            : path.join(args.resolveDir, args.path),
          namespace: 'raw-loader',
        };
      });
      build.onLoad(
        { filter: /\?raw$/, namespace: 'raw-loader' },
        async (args) => {
          return {
            contents: await readFile(args.path.replace(/\?raw$/, '')),
            loader: 'text',
          };
        }
      );
    },
  };
}

// esbuild watch in dev mode to rebuild out files
const watchOptions = {
  onRebuild(error) {
    if (error)
      console.error('esbuild: Watch build failed:', error.getMessage());
    else console.log('esbuild: Watch build succeeded');
  },
};

const commonBuildOptions: BuildOptions = {
  bundle: true,
  write: true,
  format: 'esm',
  target: ['es2020'],
  outdir: './dist',
  external: ['fs', 'events', 'stream', 'path', 'util', 'constants', 'assert'],
  pure: ['console.log', 'console.time', 'console.timeEnd'],
  sourcemap: false,
};

// IMPORTANT NOTE
// Watch mode has been disabled
// We need to re-think the watch strategy after esbuild 17
// see https://github.com/evanw/esbuild/blob/main/CHANGELOG.md#0170

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
      'worker-internals': './src/worker/worker.ts',
    },
    format: 'esm',
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
      worker: './src/worker/index.ts',
    },
    format: 'esm',
    minify: false,
    plugins: [rawPlugin()],
  });

  // Cleanup worker-internals since they are bundled into the worker.
  await rm('./dist/worker-internals.js');
} catch (error) {
  console.error(error);
  process.exit(1);
}
