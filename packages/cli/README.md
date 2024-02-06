# @openfn/cli

This package contains a new devtools CLI for running and deploying OpenFn jobs.

The CLI includes:

- A secure runtime for executing OpenFn jobs and workflows
- A compiler for making OpenFn jobs runnable
- Configurable logging output
- Auto-installation of language adaptors
- Support for the adaptors monorepo
- Deployment of workflows to OpenFn (and Lightning)

## Getting Started

- [Installation](#installation)
- [Updating](#updating)
- [Terminology](#terminology)
- [Migrating from devtools](#migrating-from-devtools)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [Deploying Workflows](#deploying-workflows)
- [Logging](#logging)
  - [Structured/JSON logging](#structuredjson-logging)
- [Workflows](#workflows)
- [Compilation](#compilation)
- [Contributing](#contributing)
  - [Usage from this repo](#usage-from-this-repo)
  - [Installing globally](#installing-globally)
  - [Repo Directory](#repo-directory)
  - [Contribution changes](#contribution-changes)

## Installation

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

## Updating

You should be able to install a new version straight on top of your current installation:

```
npm install -g @openfn/cli
```

If this fails, try uninstalling the current version first:

```
npm uninstall -g @openfn/cli
```

And then re-installing.

## Terminology

The CLI (and the wider OpenFn stack) has some very particular terminology

- An **Expression** is a string of Javascript (or Javascript-like code) written to be run in the CLI or Lightning.
- A **Job** is an expression plus some metadata required to run it - typically an adaptor and credentials.
  The terms Job and Expression are often used interchangeably.
- A **Workflow** is a series of steps to be executed in sequence. Steps are usually Jobs (and so job and step are often used
  interchangeably), but can be Triggers.
- An **Execution Plan** is a Workflow plus some options which inform how it should be executed (ie, start node, timeout).
  The term "Execution plan" is mostly used internally and not exposed to users, and is usually interchangeable with Workflow.

Note that an expression is not generally portable (ie, cannot run in other environments) unless it is compiled.
A compiled expression has imports and exports and, so long as packages are available, can run in a simple
JavaScript runtime.

## Basic Usage

You're probably here to run Workflows (or individual jobs), which the CLI makes easy:

```
openfn path/to/workflow.json
openfn path/to/job.js -ia adaptor-name
```

If running a single job, you MUST specify which adaptor to use.

Pass the `-i` flag to auto-install any required adaptors (it's safe to do this redundantly, although the run will be a little slower).

When finished, the CLI will write the resulting state to disk. By default the CLI will create an `output.json` next to the job file. You can pass a path to output by passing `-o path/to/output.json` and state by adding `-s path/to/state.json`. You can use `-S` and `-O` to pass state through stdin and return the output through stdout.

The CLI maintains a repo for auto-installed adaptors. Run `openfn repo list` to see where the repo is, and what's in it. Set the `OPENFN_REPO_DIR` env var to specify the repo folder. When autoinstalling, the CLI will check to see if a matching version is found in the repo. `openfn repo clean` will remove all adaptors from the repo. The repo also includes any documentation and metadata built with the CLI.

You can specify adaptors with a shorthand (`http`) or use the full package name (`@openfn/language-http`). You can add a specific version like `http@2.0.0`. You can pass a path to a locally installed adaptor like `http=/repo/openfn/adaptors/my-http-build`.

If you have the adaptors monorepo set up on your machine, you can also run adaptors straight from the local build. Pass the `-m <path>` flag to load from the monorepo. You can also set the monorepo location by setting the `OPENFN_ADAPTORS_REPO` env var to a valid path. After that just include `-m` to load from the monorepo. Remember that adaptors will be loaded from the BUILT package in `dist`, so remember to build an adaptor before running!

You can pass `--log info` to get more feedback about what's happening, or `--log debug` for more details than you could ever use.

## Advanced Usage

The CLI has a number of commands (the first argument after `openfn`):

- execute - run a job
- compile - compile a job to a .js file (prints to stdout by default)
- docs - show documentation for an adaptor function
- repo - manage the repo of installed modules
- docgen - generate JSON documentation for an adaptor based on its typescript

For example, `openfn compile job.js -a common` will compile the code at `job.js` with the common adaptor.

If no command is specified, execute will run.

To get more information about a command, including usage examples, run `openfn <command> help`, ie, `openfn compile help`.

## Deploying Workflows

> ⚠️ This feature is still in active development. Expect breaking changes.

The CLI can deploy workflows to OpenFn.org and instances of Lightning.

In order to deploy a workflow, you need the follow:

- A project file written in YAML
- A config file (or env vars) with your OpenFn credentials

Example project file:

```yaml
---
name: my-new-project
workflows:
  workflow-one:
    name: My New Workflow
    jobs:
      job-a:
        name: My First Job
        enabled: true # default
        adaptor: @openfn/language-http@latest
        body: |
          alterState(state => {
            console.log("Hello world!");
            return state;
          });
      job-b:
        name: My Second Job
        adaptor: @openfn/language-common@latest
        body: |
          alterState(state => {
            console.log("Hello world!");
            return state;
          });
    triggers:
      trigger-one:
        type: webhook # default
    edges:
      webhook->job-a:
        source_trigger: trigger-one
        target_job: job-a
      job-a->job-b:
        source_job: job-a
        target_job: job-b

```

Example config file:

```jsonc
{
  // Required, can be overridden or set with `OPENFN_API_KEY` env var
  "apiKey": "***",

  // Optional: can be set using the -p, defaults to project.yaml
  "specPath": "project.yaml",

  // Optional: can be set using -s, defaults to .state.json
  "statePath": ".state.json",

  // Optional: defaults to OpenFn.org's API, can be overridden or set with
  // `OPENFN_ENDPOINT` env var
  "endpoint": "https://app.openfn.org"
}
```

**Environment Variables**

You can also set the following environment variables to avoid using a config file:

- `OPENFN_API_KEY` - your OpenFn/Lightning API key
- `OPENFN_ENDPOINT` - the endpoint to deploy to (defaults to OpenFn.org)

**Using the CLI**

```bash
OPENFN_API_KEY="***" \
openfn deploy

# [CLI] ♦ Changes:
#  {
# + ... diff
# - ... diff
#  }
#
# ? Deploy? yes
# [CLI] ♦ Deployed.
```

**Flags and Options**

- `-p, --project-path <path>` - path to the project file (defaults to `project.yaml`)
- `-s, --state-path <path>` - path to the state file (defaults to `.state.json`)
- `-c, --config, --config-path` - path to the config file (defaults to `.config.json`)
- `--no-confirm` - skip the confirmation prompt

## Logging

The CLI is actually a collection of packages, each of which will log with slightly different rules. To help understand where logs are coming from, each package prints a namespace or prefix at the start of its log.

- [CLI] - the CLI itself, responsible for parsing and validating user input, reading and writing to disk, and executing the correct functionality.
- [CMP] - the Compiler will parse openfn jobs into executable Javascript, changing your code
- [R/T] - the Runtime executes your job code in a secure sandboxed environment, one operation at a time
- [JOB] - the actual job code that your wrote. Any console.log statements in your job will appear under this namespace.

The CLI will log information at three different levels of verbosity: `default`, `info` and `debug` (`none` is also supported).

To set the log level, pass `--log info` into your command. You can configure this for individual packages, ie `--log cmp=debug` will run the compiler with debug logging but leave everything else at default. To control multiple components, use comma-seperated values, ie, `--log debug,r/t=none,job=info`

Note that, unless explicitly overriden, jobs will always report at debug verbosity (meaning job logging will always be shown).

If something unexpected happens during a command, your first step should be to re-run with info-level logging.

`default` logging is designed to give high-level feedback about what you absolutely need to know. It will show any errors or warnings, as well as high-level reporting about what the command has actually done.

`info` level logging is suitable for most developers. It is more verbose than default but still aims to provide high-level information about a command. It includes version numbers, key paths, and simple reporting about how the compiler changes your code (see below).

`debug` level logging is highly verbose and aims to tell you everything that's going on under-the hood. This is aimed mostly at CLI/runtime developers and can be very useful for debugging problems.

### Structured/JSON logging

By default all logs will be printed as human-readable strings.

For a more structured output, you can emit logs as JSON objects with `level`, `name` and `message` properties:

```

{ level: 'info', name: 'CLI', message: ['Loaded adaptor'] }

```

Pass `--log-json` to the CLI to do this. You can also set the OPENFN_LOG_JSON env var (and use `--no-log-json` to disable).

## Workflows

A workflow is an execution plan for running several jobs in a sequence. It is defined as a JSON structure.

To see an example workflow, run the test command with `openfn test`.

A workflow has a structure like this:

```json
{
  "workflow": {
    "name": "my-workflow", // human readable name used in logging
    "steps": [
      {
        "name": "a", // human readable name used in logging
        "expression": "fn((state) => state)", // code or a path to an expression.js file
        "adaptor": "@openfn/language-common@1.7.5", // specifiy the adaptor to use (version optional)
        "data": {}, // optionally pre-populate the data object (this will be overriden by keys in in previous state)
        "configuration": {}, // Use this to pass credentials
        "next": {
          // This object defines which jobs to call next
          // All edges returning true will run
          // If there are no next edges, the workflow will end
          "b": true,
          "c": {
            "condition": "!state.error" // Note that this is a strict Javascript expression, not a function, and has no adaptor support
          }
        }
      }
    ]
  },
  "options": {
    "start": "a" // optionally specify the start node (defaults to steps[0])
  }
}
```

See `packages/lexicon` for type definitions (the workflow format is covered by the `ExecutionPlan` type)/

## Compilation

The CLI will compile your job code into regular Javascript. It does a number of things to make your code robust and portable:

- The language adaptor will be imported into the file
- The adaptor's execute function will be exported from the file
- All top level operations will be added to an array
- That operation array will be made the default export of the file

The result of this is a lightweight, modern JS module. It can be executed in any runtime environment: just execute each function in the exported array.

The CLI uses openfn's own runtime to execute jobs in a safe environment.

If you want to see how the compiler is changing your job, run `openfn compile path/to/job -a <adaptor>` to return the compiled code to stdout. Add `-o path/to/output.js` to save the result to disk.

## Contributing

First of all, thanks for helping! You're contributing to a digital public good that will always be free and open source and aimed at serving innovative NGOs, governments, and social impact organizations the world over! You rock. heart

To get this started, you'll want to clone this repo.

You also need to install `pnpm`.

### Usage from this repo

You can run the cli straight from source with `pnpm`

```

$ pnpm openfn path/to/job.js
$ pnpm openfn -h

```

See test/execute.test.ts for more usage examples

### Installing globally

To install the CLI globally from the build in repo:

```

$ npm install -g .

```

Note that this will install the built source from `dist`

### Repo Directory

The CLI will save and load adaptors from an arbitrary folder on your system.

You should set the OPENFN_REPO_DIR env var to something sensible.

In `~/.bashrc` (or whatever you use), add:

```

export OPENFN_REPO_DIR=~/repo/openfn/cli-repo

```

To run adaptors straight from the adaptors monorepo:

export OPENFN_ADAPTORS_REPO=~/repo/openfn/adaptors

### Contributing changes

Include a changeset and a description of your change. Run this command and follow the interactive prompt (it's really easy, promise!)

```
pnpm changeset
```

Commit the changeset files and open a PR at https://github.com/openfn/kit.
