## Runtime

A runtime for running openfn jobs and reporting on their status.

The runtime will load an array of operations from a module and execute them in series.

An operation is a function which takes state as input and returns state, or a promise resolving to state, as output.

```js
run([
  (state) => state
])
```

The compiler can be used to convert job DSL into an compatible ESM module.

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

You can test or watch tests with

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

The runtime should not:

- Compile its input jobs (although it will validate using the compiler)
- Do any disk I/O
- Do any thread/process management (see the runtime manager)

## Module Loading & Linking

When loading jobs from a string, they will be loaded as an ESM module. This uses the experimental `vm.SourceTextModule`.

If the job contains imports of its own, `vm` will not resolve those imports. We have to provide a linker function to handle it. Our linker function will:
* Import the required module
* Create a `vm.SyntheticModule` to act as a proxy to it
* Load the synthetic module into the job's runtime context.

You can pass a whitelist (as an array of regexes) to only allow matching modules to be loaded.

By default, imports will be resolved using node's resolution algorithm relative to the runtime's directory. This is unhelpful as the runtime itself doesn't depend on packages the jobs need (like language adaptors).

The linker accepts a moduleHome, which accepts a folder to load linked modules from. This is a hook allowing adaptors to be loaded from the local filesystem. Soon we'll also be able to pass specific paths and maybe even point to the local langauge adaptor monorepo to load from there.

We may add support for dynamic module loading - ie, the linker will download the module from unpkg.

We will want to extend this functionality to allow version control on adaptors (ie, we can make `import { fn } from '@open/language-common@2.0.0-rc3` work)
