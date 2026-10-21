## Integration Tests

This package contains a set of integration tests against `openfn` CLI.

The test suite is designed to be run in CircleCI, but can also run locally.

## Running Tests

During development, you can run the unit tests against a local build (ie, `packages/cli/dist`):

`pnpm test:dev`

## Architecture

The basic idea here is to test the built (but unreleased) CLI bundle in the global space.

Test names should be the actual command under test. This makes it easy to reproduce a failing test locally.

How it works:

- Build and package the report into a set of tarballs. This uses `pack:local` so that the tarballs are self-referencing.
- Install the CLI globally in a clean environment from these tarballs.
- Unit tests in ava will run commands against the global command (using child_process.exec). They assert against logging and JSON output.

## Creating tarballs

From the repo root, run `pnpm pack:local integration-tests/cli/dist --no-version` to create a bunch of tarballs from your built packages. Tarballs will be built to `dist`.

From this folder, install the CLI from the tarballs with `npm install -g ./dist/openfn-cli.tgz`.
