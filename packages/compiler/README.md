# @openfn/compiler

Compiler and utils for inspecting and compiling OpenFn Jobs.

The compiler at it's present moment is presented as a WebWorker, and only
works in the browser.

Using a Worker is **strongly recommended** since it includes the TypeScript
compiler - which although can be pretty performant, it's heavy and can
lock up your UI when inspecting code.

## Usage

### In the browser

The worker is an ESM module compatible with current versions of Firefox and
Chrome. We recommend loading it as a dynamic import allowing you to control
when it's loaded as not to waste network and memory resources before you 
need it.

```js
const { startWorker } = await import("@openfn/compiler/worker")
const worker = await startWorker();
const results = await worker.describeAdaptor("a .d.ts as a string");
```

## Building

The Worker is built in two phases:

1. Bundle up the worker which includes the TypeScript compiler.
2. Compile the entrypoint, which injects the worker as a string.

By splitting this up we can produce a single file that can be used in the browser.

