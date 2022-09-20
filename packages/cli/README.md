# @openfn/cli (devtools)

This package contains a new devtools CLI.

The CLI allows you to
* Run a job (expression), writing output to disk or stdout
* ~~Compile a job~~ (coming soon)
* ~~Validate a job~~ (coming soon)
* Use local language adaptors to run the job

The CLI reads a path as its main argument. That path should either point to a .js file or a folder.

* If the path ends in .js, load as a job file and execute. State and output will be read/written relative to it.
* If the path is a folder, the CLI will look for a job.js, state.json and write an output.json.

From this input it will infer a working directory, from which state will be read and output will be written.

All inputs and outputs can be configured with arguments.

Run `pnpm openfn -h` to print usage help (the best source of truth right now).

## Usage from the global CLI

See Getting Started for more setup steps.

```
$ npm install -g @openfn/cli`
$ openfn --help
$ openfn path/to/expression.js`
```

## Usage from this repo

```
$ pnpm openfn path/to/job.js
$ pnpm openfn -h
$ pnpm build:watch
```

See test/execute.test.ts for more usage examples

## Current state

For legacy jobs (ie, jobs without explicit imports), the new runtime is only compatible with language adaptors with type definitions.

Right now, that means @openfn/language-common@2.0.0-rc3.

## Getting Started

Here's how I recommend getting set up:

* Create a folder for next-gen language adaptors somewhere on your machine

```
$ mkdir -p ~/adaptors/@openfn
```

* Clone `language-common` into that folder

```
git clone https://github.com/OpenFn/language-common.git ~/adaptors/@openfn --branch 2.0.0-pre
```

* Set your `OPENFN_MODULES_HOME` environment variable to point to the next-gen adaptors folder. This will tell the CLI to load adaptors from this folder by default.

```
# In ~/.bashc or whatever
export OPENFN_MODULES_HOME=~/adaptors/@openfn
```

This will improve in future, as we implement automatic module loading and add type definitions to the published adaptor packages.

## Automatic Imports

The v2 runtime requires explicit imports to be in the job file, or else the job will fail.

The v2 compiler can automatically insert import statements, but it needs to be told which adaptor to use.

```
$ openfn job.js --adaptors @openfn/language-http
$ openfn job.js --adaptors @openfn/language-http=path/to/adaptor
```

If a path is passed (relative to the working directory), that path will be used to load a local version of the adaptor (both at runtime and for import generation)

If no path is passed, the currently deployed npm package will be used.

## Notes on Module Resolution

Any import statements inside a job have to resolve to a node module.

A module can be resolved:

* Relative to the env var OPENFN_MODULE_HOME
* Relative to CLI's node_modules
* Relative to global node_modules

Basically, to work with adaptors, you should:

* Save your adaptors globally

Or

* Save adaptors to a folder somewhere (~/openfn) and set OPENFN_MODULE_HOME=~/openfn
