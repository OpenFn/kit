# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OpenFn kit is the pnpm monorepo behind OpenFn's workflow automation: the CLI, the Runtime that executes jobs, and the Worker that runs jobs in production for Lightning (OpenFn's web platform).

## How the pieces fit

- **@openfn/runtime** executes a workflow plan in a sandboxed Node VM. A workflow is a graph of steps (jobs) joined by conditional edges. A job is an array of operations, each a function from state to state. State is never mutated between jobs.
- **@openfn/compiler** turns job DSL into a standard ES module that imports from its adaptor (an npm package such as `@openfn/language-http`) and exports the operations array.
- **@openfn/cli** is the local frontend. It compiles jobs itself and calls the runtime in-process.
- **@openfn/ws-worker** is the production frontend. It is stateless: it claims runs from Lightning over websockets and reports events back, and Lightning owns all persistence. It never imports the compiler. It hands plans to **@openfn/engine-multi**, which compiles and runs each one in a worker thread inside a child process.
- **@openfn/project** models local projects and workspaces (`Workspace`, `Project`, YAML parsing, diffs, version hashes). The CLI's `project` handlers in `packages/cli/src/projects/` are thin layers over it, and this is the most actively developed area of the repo. Sync with Lightning uses its v2 endpoint.
- Supporting: `lexicon` (shared types), `logger`, `lightning-mock` (fake Lightning for worker tests), `deploy` and `describe-package` (both being phased out).

Every internal dependency is `workspace:*` and resolves to the dependency's built `dist/`, not its `src/`. engine-multi also runs its worker processes from `dist/`.

## Commands

Node is pinned in `.tool-versions` (use `asdf`), and pnpm switches itself to the version pinned in `packageManager` (install any pnpm with `npm install -g pnpm`; corepack no longer ships with Node).

```bash
pnpm install
pnpm build                      # all packages
pnpm --filter @openfn/cli build # one package
pnpm test                       # all package tests
pnpm test:types                 # tsc per package
pnpm format / pnpm test:format  # prettier write / check (there is no eslint)
pnpm _typesync                  # after changing dependencies
```

Tests use ava with the shared root `ava.config.js`, which runs `test/**/*test.ts` straight from `src/` via `@swc-node/register`. Because workspace deps come from `dist/`, run `pnpm build` first when a test crosses packages or uses engine-multi. When unsure, build.

```bash
cd packages/project
pnpm ava test/util/config.test.ts            # one file
pnpm ava test/util/config.test.ts -m "name*" # tests matching a title
```

ws-worker and engine-multi run with `--serial`; keep new tests there compatible with that.

### Running things locally

- **CLI**: `cd packages/cli && pnpm openfn <command>` runs the built `dist/`, so rebuild (or `pnpm build:watch`) after changes. `pnpm install:global` from root installs a global `openfnx` for testing; remove it with `npm uninstall -g @openfn/clix`.
- **Worker**: `cd packages/ws-worker && pnpm start` connects to Lightning at `localhost:4000`. `-l mock` uses the mock Lightning, `--mock` uses a mock engine, and `--no-loop` stops auto-claiming so you can trigger claims with `curl -X POST http://localhost:2222/claim`. Options and their `WORKER_*` env vars are in `packages/ws-worker/src/util/cli.ts`.
- CLI env vars (`OPENFN_API_KEY`, `OPENFN_ENDPOINT`, `OPENFN_REPO_DIR`, `OPENFN_ADAPTORS_REPO`, and others) are defined in `packages/cli/src/options.ts` and `packages/cli/src/projects/options.ts`.

### Integration tests

These live in `integration-tests/` (`cli`, `execute`, `worker`, `legacy-deploy`) and run against built packages. Always `pnpm build` first.

- `pnpm test:integration` from root runs them all.
- In `integration-tests/cli`, `pnpm test:dev` uses the local `packages/cli/dist`. Plain `pnpm test` expects a globally installed `openfn`, which is how CI runs it: `pnpm pack:local` then install the tarball globally.

## Adding a CLI command

Commands are yargs modules registered in `packages/cli/src/cli.ts`. Each module calls `ensure('<command-name>', ...)` (`util/command-builders.ts`) to set `argv.command`, and `packages/cli/src/commands.ts` dispatches that string to a handler. A new `project` subcommand needs all three of:

1. a yargs module added in `packages/cli/src/projects/command.ts`;
2. the handler exported from `packages/cli/src/projects/index.ts`;
3. an entry in the `handlers` map and the `CommandList` union in `commands.ts`.

`packages/cli/src/projects/list.ts` is the simplest example to copy.

## Changesets and releases

Every PR that changes a published package needs a changeset (`pnpm changeset`). The release note is a **single, short, high-level sentence**, and vague is fine (e.g. `added new "compile-test" command to the CLI`). Leave out files, functions and implementation detail. Breaking changes may add a short migration guide after the sentence. The package `CHANGELOG.md` files show the house style.

Releases are prepared by hand on a release branch: run `pnpm changeset version`, check the changelogs, run `pnpm install`, and commit. Merging to main then publishes to npm and builds the worker Docker image. A brand-new package must be published once first with `pnpm publish:new`; see `README.md`.

## Further guides

Read these before working in the matching area:

- [.claude/event-processor.md](.claude/event-processor.md): how the worker orders and batches events sent to Lightning.
- [.claude/yaml-formats.md](.claude/yaml-formats.md): v1 vs v2 project YAML, how each is detected, and how they convert.
- [.claude/unit-testing-jobs.md](.claude/unit-testing-jobs.md): compiling a job so it can be unit tested.
- `packages/runtime`, `packages/engine-multi` and `packages/ws-worker` each have their own `CLAUDE.md`, loaded automatically when you work there.
