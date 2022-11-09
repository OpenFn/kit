## Runtime

A runtime for running openfn jobs and reporting on their status.

The runtime will load an array of operations from a module and execute them in series.

An operation is a function which takes state as input and returns state, or a promise resolving to state, as output.

```js
run([(state) => state]);
```

The compiler can be used to convert job DSL into an compatible ESM module (the runtime does not do this automatically).

## Basic Usage

The runtime should be passed the source for a single job (as a string, as a module which exports an array of functions.)

```js
import { readFile } from 'node:fs/promises';
import run from '@openfn/runtime';

const job = await readFile('expression.js', 'utf8');
const initialState = {};
const { data } = await run(source, initialState);
```

See the `test` folder for more usage examples.

The runtime provides no CLI. Use packages/cli (devtools) for this.

## Experimental VM Args

For the runtime to work, the parent process needs two experimental vm args to be passed:

```
--experimental-vm-modules
--experimental-specifier-resolution=node
```

You may also want to pass `--no-warnings` to suppress annoying console warnings.

## Building

To build a js package into `dist/`, run:

```
$ pnpm build
```

To watch and re-build whenever the js changes, run

```
$ pnpm build:watch
```

Note: The watch throws an error on first run but seems to work.

You can test or watch tests with:

```
$ pnpm test
$ pnpm test:watch
```

## Runtime Design

The runtime's job is to take a pipline of operations and execute them in series.

The runtime should:

- Accept a pipleline as an array of functions or a stringified ESM module
- Validate the input string to ensure there's no security concerns (like blacklisted imports)
- Execute the pipeline in a safe environment (with some utilities and overrides provided)
- Ensure that the state object is not mutated between jobs
- Return a promise and event-emitted (with a `on(event)` function)
- Emit lifecycle events for the job pipeline
- Resolve to a state object
- Load runtime dependencies from explicit paths or a local repo

The runtime should not:

- Compile its input jobs (although it will validate using the compiler)
- Do any disk I/O
- Do any thread/process management (see the runtime manager)
- Auto install any dependencies

## Module Loading

When a job calls `import` to import a dependent module, the runtime must resolve the import statement into executable code.

It does this through a `linker` function, which takes as arguments a package specifier and `vm` context, and an options object. It will load the module using a dynamic `import` and proxy the interface through a `vm.SyntheticModules`, usng the experimental `vm.SourceTextModule` API.

Modules can be loaded from:
- An explicit path (pass as a dictionary of name: path strings into the options)
- The current working repo (see below)
- The current working node_modules (should we somehow disallow this?)

The repo is a managed folder which the runtime uses to install and load modules from/to. It is just an arbitrary private npm package (ie, a folder containing a package.json and node_modules). Generally, it is expected that linked modules are loaded from this folder.

The runtime is self-managing and won't do any installs itself, that's up to the runtime manager to sort out

A whitelist can be passed (as an array of regexes) to the linker's options, only allow matching modules to be loaded.

Right now, it's expected that the runtime manager (ie the CLI) will manage the installation of dependencies into the repo before executing the runtime. Later, we may allow the runtime to auto-install dependencies from directives at the top of the job source.
