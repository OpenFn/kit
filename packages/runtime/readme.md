## Runtime

A runtime for running openfn jobs and reporting on their status.

The runtime will load an array of operations from a module and execute them in series.

An operation is a function which takes state as input and returns state, or a promise resolving to state, as output.
```
run([
  (state) => state
])
```

The compiler can be used to convert job DSL into an compatible ESM module.

## Basic Usage

The runtime should be passed the source for a single job (as a string, as a module which exports an array of functions.)

```
import { readFile } from 'node:fs/promises';
import run from '@openfn/runtime';

const job = await readFile('expression.js', 'utf8');
const initialState = {};
const { data } = await run(source, initialState);
```

See the `test` folder for more usage examples.

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

* Accept a pipleline as an array of functions or a stringified ESM module
* Validate the input string to ensure there's no security concerns (like blacklisted imports)
* Execute the pipeline in a safe environment (with some utilities and overrides provided)
* Ensure that the state object is not mutated between jobs
* Return a promise and event-emitted (with a `on(event)` function)
* Emit lifecycle events for the job pipeline
* Resolve to a state object

The runtime should not:
* Compile its input jobs (although it will validate using the compiler)
* Do any disk I/O 
* Do any thread/process management (see the runtime manager)

## Module Loading & Linking

When loading jobs from a string, they will be loaded as an ESM module. This uses the experimental vm.SourceTextModule.

If the job contains imports of its own, `vm` will not resolve those imports. We have to provide a linker function to handle it.

At the moment, the linker is very trivial, and simply projects imports from the runtime's own environment into the module via vm.Synthetic Module. You can pass a whitelist, as an array of regexes, to only allow matching modules to be loaded.

We will want to extend this functionality to allow version control on adaptors (ie, we can make `import { fn } from '@open/language-common@2.0.0-rc3` work)