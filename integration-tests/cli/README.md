## Integration Tests

This package contains a set of integration tests against `openfn` CLI.

The test suite is designed to be run in CircleCI, but can run locally or in a local docker image.

## Running Tests

During developingment, you can run the unit tests against a local build (ie, `packages/cli/dist`):

`pnpm test:dev`

You can run the test in isolation with a docker build. This can be useful while developign for CI, or if a test passes locally but fails in CI.

`pnpm run build`
`pnpm run start`

## Architecture

The basic idea here is to test the built (but unreleased) CLI bundle in the global space.

Test names should be the actual command under test. This makes it easy to reproduce a failing test locally.

How it works:

* Build and package the report into a set of tarballs. This uses `pack:local` so that the tarballs are self-referencing. 
* Install the CLI globally in a clean environment from these tarballs.
* Unit tests in ava will run commands against the global command (using child_process.exec). They assert against logging and JSON  output.

## Creating tarballs

From this folder, run `build:pack` to create a bunch of tarballs from your built packages. Tarballs will be built to `dist`.

You can install the tarballs locally with `npm install -g dist openfn-cli.tgz.`