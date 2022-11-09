# @openfn/describe-package

Utility for inspecting and describing an arbitrary npm package.

## Usage

There is a demo project available in [examples/compiler-worker](../../examples/compiler-worker/).

### Inspecting a module

```js
import { Pack, Project, describeDts } from "@openfn/describe-package";

const project = new Project();

// Load a module from Unpkg
const pack = await Pack.fromUnpkg("@openfn/language-common@2.0.0-rc1");

const packageOrDts = /(?:package.json)|(?:\.d\.ts$)/i;

if (!pack.types) {
  throw new Error(
    `No 'types' field found for ${pack.specifier}`
  );
}

// Download the `package.json` and `.d.ts` files.
const files = await pack.getFiles(
  pack.fileListing.filter((path) => packageOrDts.test(path))
);

// Add the files to the Project filesystem.
project.addToFS(files);

// Add the types entrypoint (e.g. `index.d.ts`) as a 'project file'.
project.createFile(files.get(pack.types), pack.types);

// And finally get a list of exported members from a module.
const operations = describeDts(project, pack.types);
```

### Project

The `Project` object is a wrapper around the Typescript compiler, providing
the necessary hooks to interact with code and module type definitions.

## Workers

> ⛔ Not working currently. 

```js
const { startWorker } = await import("@openfn/describe-package/worker");
const worker = await startWorker();
const results = await worker.describeAdaptor("a .d.ts as a string");
```

## Building

There are three scripts:

- `pnpm test`  
  Runs the tests
- `pnpm run build`  
  Cleans up `dist` and builds for packaging for npm.
- `pnpm run watch`  
  Rebuilds on changes.

The Worker is built in two phases:

1. Bundle up the worker which includes the TypeScript compiler.
2. Compile the entrypoint, which injects the worker as a string.

By splitting this up we can produce a single file that can be used in the browser.
