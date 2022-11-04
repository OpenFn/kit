# @openfn/cli (devtools)

This package contains a new devtools CLI.

The CLI allows you to

- Run a job (expression), writing output to disk or stdout
- Compile a job
- Install modules for jobs
- Use local language adaptors to run the job

The CLI reads a path as its main argument. That path should either point to a .js file or a folder.

- If the path ends in .js, load as a job file and execute. State and output will be read/written relative to it.
- If the path is a folder, the CLI will look for a job.js, state.json and write an output.json.

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

## legacy Jobs failing?

If you're running a job without an explicit import statement (ie, any job not written specifically for this new runtime), the CLI will probably fail.

You need to pass the name of an adaptor for the runtime to use. It will auto-insert an import statement for you.

```
$ openfn job.js -a @openfn/language-commmon
```

The adaptor also needs to be installed in the CLI's module repo. You can do this manually:

```
$ openfn install @openfn/language-commmon
```
If no version is provided, the latest will be installed.

Alternatively, pass the -i flag when running a job (it's safe to do this redundantly):
```
$ openfn job.js -i -a @openfn/language-commmon
```

## Usage from this repo

You can run the cli straight from source with `pnpm`

```
$ pnpm openfn path/to/job.js
$ pnpm openfn -h
```

See test/execute.test.ts for more usage examples

## Installing globally

To install the CLI globally from this repo (ie, to do `openfn job.js` instead of `pnpm openfn job.js`), run:

```
$ npm install -g .
```

Note that this will install the built source from `dist`

## Repo Directory

The CLI will save and load adaptors from an arbitrary folder on your system.

You should set the OPENFN_REPO_DIR env var to something sensible.

```
# In ~/.bashc or whatever
export OPENFN_REPO_DIR=~/adaptors/@openfn
```

At the time of writing, teh env var name is about to change. Soon you will be able to pass the repo dir into the command line, but the env var is a much easier way to work.

Monorepo support is coming soon.

## Automatic Imports

The v2 runtime requires explicit imports to be in the job file, or else the job will fail.

The v2 compiler can automatically insert import statements, but it needs to be told which adaptor to use.

```
$ openfn job.js --adaptors @openfn/language-http
$ openfn job.js --adaptors @openfn/language-http=path/to/adaptor
```

If a path is passed (relative to the working directory), that path will be used to load a local version of the adaptor (both at runtime and for import generation)

If no path is passed, the currently deployed npm package will be used.
