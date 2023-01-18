# @openfn/cli

This package contains a new devtools CLI for running openfn jobs.

The new CLI includes:

* A new runtime for executing openfn jobs
* A new compiler for making openfn jobs runnable
* Improved, customisable logging output
* Auto installation of language adaptors
* Support for the adaptors monorepo

## Getting Started

To install:

```
npm install -g @openfn/cli
```

Make sure everything works by running the built-in test job:

```
openfn test
```

Check the version:

```
openfn -v
```

Get help:

```
openfn help
```

## Basic Usage

You're probably here to run jobs (expressions), which the CLI makes easy:

```
openfn path/to/job.js -ia adaptor-name
```

You MUST specify which adaptor to use. Pass the `-i` flag to auto-install that adaptor (it's safe to do this redundantly).

If output.json and state.json are not passed, the CLI will look for them next to the job.js file. You can pass a path to state by adding `-s path/to/state.json`, and output by passing `-o path/to/output.json`. You can use `-S` and `-O` to pass state through stdin and return the output through stdout.

The CLI can auto-install language adaptors to its own privately maintained repo. Run `openfn repo list` to see where the repo is, and what's in it. Set the `OPENFN_REPO_DIR` env var to specify the repo folder. When autoinstalling, the CLI will check to see if a matching version is found in the repo.

You can specify adaptors with a shorthand (`http`) or use the full package name (`@openfn/language-http`). You can add a specific version like `http@2.0.0`. You can pass a path to a locally installed adaptor like `http=/repo/openfn/adaptors/my-http-build`. Set the OPENFN_ADAPTORS_REPO env var to load adaptors straight out of the monorepo (pass the `--no-adaptors-repo` flag to disable this for a single run).

You can pass `--log info` to get more feedback about what's happening, or `--log debug` for more details than you could ever use.

## Advanced Usage

The CLI has actually has a number of commands (the first argument after openfn)

* execute - run a job
* compile - compile a job to a .js file
* doc - show documentation for an adaptor function
* repo - manage the repo of installed modules
* docgen - generate JSON documentation for an adaptor based on its typescript

If no command is specified, execute will run.

To get more information about a command, including usage examples, run `openfn <command> help`, ie, `openfn compile help`.

## Logging 

The CLI is actually a collection of packages, each of which will log with slightly different rules. To help understand where logs are coming from, each package prints a namespace or prefix at the start of its log.

* [CLI] - the CLI itself, responsible for parsing and validating user input, reading and writing to disk, and executing the correct functionality.
* [CMP] - the Compiler will parse openfn jobs into executable Javascript, changing your code
* [R/T] - the Runtime executes your job code in a secure sandboxed environment, one operation at a time
* [JOB] - the actual job code that your wrote. Any console.log statements in your job will appear under this namespace.

The CLI will log information at three different levels of verbosity: `default`, `info` and `debug` (`none` is also supported).

To set the log level, pass `--log info` into your command. You can configure this for individual packages, ie `--log cmp=debug` will run the compiler with debug logging but leave everything else at default.

Note that, unless explicitly overriden, jobs will always report at debug verbosity (meaning job logging will always be shown).

If something unexpected happens during a command, your first step should be to re-run with info-level logging.

`default` logging is designed to give high-level feedback about what you absolutely need to know. It will show any errors or warnings, as well as high-level reporting about what the command has actually done.

`info` level logging is suitable for most developers. It is more verbose than default but still aims to provide high-level information about a command. It includes version numbers, key paths, and simple reporting about how the compiler changes your code (see below).

`debug` level logging is highly verbose and aims to tell you everything that's going on under-the hood. This is aimed mostly at CLI/runtime developers and can be very useful for debugging problems.

## Structred/JSON logging

By default all logs will be printed as human-readable strings.

For a more structured output, you can emit logs as JSON objects with `level`, `name` and `message` properties:
```
{ level: 'info', name: 'CLI', message: ['Loaded adaptor'] }
```

Pass `--log-json` to the CLI to do this. You can also set the OPENFN_LOG_JSON env var (and use `--no-log-json` to disable).

## Compilation

The CLI will attempt to compile your job code into normalized Javascript. It will do a number of things to make your code robust and portable:

* The language adaptor will be imported into the file
* The adaptor's execute function will be exported form the file
* All top level operations will be added to an array
* That array will be made the default export of the file

The result of this is a lightweight, modern JS source file. It can be executed in any runtime environment: just execute each function in the exported array.

The CLI uses openfn's own runtime to execute jobs in a safe environment.

All jobs which work against `@openfn/core` will work in the new CLI and runtime environment (note: although this is a work in progress and we are actively looking for help to test this!).

## New Runtime notes

The new openfunction runtime basically does one thing: load a Javascript Module, find the default export, and execute the functions it holds.

So long as your job has an array of functions as its default export, it will run in the new runtime.

# Contributing

First of all, thanks for helping! You're contributing to a digital public good that will always be free and open source and aimed at serving innovative NGOs, governments, and social impact organizations the world over! You rock. heart

To get this started, you'll want to clone this repo.

You also need to install `pnpm`.

## Usage from this repo

You can run the cli straight from source with `pnpm`

```
$ pnpm openfn path/to/job.js
$ pnpm openfn -h
```

See test/execute.test.ts for more usage examples

## Installing globally

To install the CLI globally from the build in repo:

```
$ npm install -g .
```

Note that this will install the built source from `dist`

## Repo Directory

The CLI will save and load adaptors from an arbitrary folder on your system.

You should set the OPENFN_REPO_DIR env var to something sensible.

```
# In ~/.bashc or whatever
export OPENFN_REPO_DIR=~/repo/openfn/cli-repo
```

To run adaptors straight from the adaptors monorepo:

export OPENFN_ADAPTORS_REPO=~/repo/openfn/adaptors

## Contributing changes

Open a PR at https://github.com/openfn/kit. Include a changeset and a description of your change.

See the root readme for more details about changests,