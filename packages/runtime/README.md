## Runtime

A runtime for running openfn workflows and reporting on their status. The runtime will return a serializable state object when the workflow is completed.

A single expression can be passed to the runtime, which will be wrapped into a single-node wowrkflow.

The runtime is designed to be wrapped into a Runtime Manager, which is responsible for compiling expressions into executable code, triggering runs (ie calling the runtime), and returning state.

Each job/expression in a workflow must export an array of operations, which will be executed in series.

An operation is a function which takes state as input and returns state (or a promise resolving to state) as output.

```js
run([(state) => state]);
```

The compiler can be used to convert the javascript-like "job DSL" into an compatible ESM module (the runtime does NOT do this automatically).

## Basic Usage

The runtime should be passed a workflow JSOn object, or a single job (as a string or as a module which exports an array of functions).

```js
import { readFile } from 'node:fs/promises';
import run from '@openfn/runtime';

const job = await readFile('expression.js', 'utf8');
const initialState = {};
const options = { logger };
const { data } = await run(source, initialState, options);
```

See the `test` folder for more usage examples.

The runtime provides no CLI. Use packages/cli (devtools) for this.

## Experimental VM Args

For the runtime to work, the parent process needs `--experimental-vm-modules` be passed. You may also want to pass `--no-warnings` to suppress annoying console warnings.

## Module Caching

If running in a long-lived process (such as inside ws-worker), the runtime may import cached modules.

This can be a problem for isolation even within the sandbox, because state can be shared by two workflows using the same adaptor. This is a security and stability concern.

To address this, the runtime accepts a cacheKey on the linker options. If set, this will be appended to the linker's imports (ie, top-level job imports). All jobs in the same workflow will use the same cacheKey, so a module is cached between jobs, but NOT between workflows.

Long-running worker processes should pass a unique cache key with each run.

IMPORTANT: This will leak memory, because loaded but "stale" modules will NOT be garbage collected.

It is expected that that long-running runtimes will have some kind of purge functionality to reclaim memory (for example, engine-multi will regulaly burn worker threads)

## Execution Plans

The runtime can accept an Execution Plan (or workflow) as an input.

This defines a graph of of jobs (expressions) to run in sequence. Each node in the graph is a job, and contains a set of edges which tell the runtime what to execute next.

The runtime will return the final state when there is nothing left to execute.

An execution plan looks like this:

```js
{
  workflow: {
    jobs: [{
      id: 'a',
      expression: "source or path",
      state: { /* default state */ },
      configuration: { /* credentials */ },
      next: {
        'b': true, // edge to another job
        'c': { condition: "state.data.age > 18", // conditional edge to another job
      }
      adaptor: "common", // it's complicated
    }]
  },
  options: {
    start: 'a',
  }
}
```

State and start node can be passed to the runtime as inputs.

If no start node is provided, the first job in the jobs array will run first.

Ids are technically optional, but needed if an edge (or start) wants to refer to a node.

The runtime itself does not use the `adaptor` key, as it expects jobs to be compiled with imports. As with expressions, it's the runtime manager's job to compile expressions and ensure dependencies are available.

See src/types.ts for a full definition of an execution plan, and `test/runtime.test.ts` for examples.

At the time of writing, exectuion plans have some restrictions:

- Jobs execute in series (but parallisation can be simulated)
- A job can only have one input node (`a -> z <- b` is not allowed)
- Jobs cannot have circular references (`a -> b -> a` is not allowed)

Support for more complex plans will be introduced later.

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

The runtime's job is to take one or more jobs and execute them in series.

Each job, in turn, is a pipeline of operations.

The runtime's repsonsibilities include:

- Accepting a workflow as JSON or a job as as string
- Executing all jobs in a safe environment (with some utilities and overrides provided)
- Ensuring that the state object is not mutated between jobs
- Emitting lifecycle events for the job pipeline
- Maintaining a repo of node modules which are available to jobs
- Loading runtime dependencies from explicit paths (passed in) or a local repo
- Resolving to a serializable state object

The runtime should not:

- Compile its input jobs (although it may validate using the compiler)
- Do any disk I/O
- Do any thread/process management
- Auto install any dependencies

These are all the responsibilities of a runtime manager (like the CLI).

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
