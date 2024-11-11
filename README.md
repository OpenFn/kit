# OpenFn Kit

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/OpenFn/kit/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/OpenFn/kit/tree/main)

**Kit** _noun_ _/kɪt/_

A set of articles or equipment needed for a specific purpose.

1. _a football kit_
1. _ICT4D's favourite kit for data integration and workflow automation_

---

This repo contains runtime, tooling, libraries and components to support the OpenFn's workflow automation and data integration pipeline.

## About OpenFn

First launched in 2014, OpenFn is the leading Digital Public Good for workflow automation. It has has been tried and tested by NGOs and governments in 40+ countries, and is a [Digital Square](https://digitalsquare.org/digital-health-global-goods) certified Global Good for Health.

Try the app online at [app.openfn.org](https://app.openfn.org)

Explore in a sandbox on [demo.openfn.org](https://demo.openfn.org)

Learn more at [docs.openfn.org](docs.openfn.org)

This monorepo contains many of the backend JavaScript services that power the app: most notably the core Runtime engine that executes OpenFn job code, the Worker service which pulls and executes Workflows from the app, and `@openfn/cli`.

## Prerequisities

- [asdf](https://github.com/asdf-vm/asdf)
- [pnpm](https://pnpm.io/installation)

We use [asdf](https://github.com/asdf-vm/asdf) to configure our local
environments and ensure consistency of versions.

You should install asdf and the [NodeJs](https://github.com/asdf-vm/asdf-nodejs) plugin.

We use [`pnpm`](https://pnpm.io/installation), a fast, disk space efficient package manager, to handle node dependencies within the repo.

## Installing

- `$ pnpm run setup`
- `$ pnpm build`

## Running Tests

```
pnpm run test
```

# Development Guide

Thanks for being here! You're contributing to a digital public good that will always be free and open source and aimed at serving innovative NGOs, governments, and social impact organizations the world over! You rock ❤️

## Releases & Changesets

We use changesets to manage releases: [`github.com/changesets`](https://github.com/changesets/changesets)

A changeset is a description of batch of changes, coupled with semver information.

### Adding a change

When submitting a PR against this repo, include a changeset to describe your work.

```
pnpm changeset
```

For example changeset notes, look in the `.changesets` folder.

### Releasing

New releases will be published to npm automatically when merging into main.

Before merging to main, check out the release branch locally and run the following steps:

1. Run `pnpm changeset version` from root to bump versions
1. Run `pnpm install`
1. Commit the new version numbers
1. Run `pnpm changeset tag` to generate tags
1. Push tags `git push --tags`

Rememebr tags may need updating if commits come in after the tags are first generated.

## TypeSync

This repo uses `typesync` to ensure that all packages have an appropriate `@types/` package.

This must be run MANUALLY (See https://github.com/OpenFn/kit/issues/333)

On every add, update and remove. you should do `pnpm run typesync` from the repo root.

Note that @types packages only synchronise with the major and minor versions of a package. So for `@types/x@major.minor.patch`, `major` and `minor` refer to the versions of the corresponding package `x`, and `patch` is the version number of the actual types package.

## Testing the CLI on a branch

From the repo root, run `pnpm install:global`.

This will build the CLI into `./dist`, set the version to the current branch name, and install it globally as `openfnx`.

Run `openfnx` to use this dev-version of the CLI without overriding your production install.

This uses a similar technique to the release CLI below.

To remove the dev cli, run `npm uninstall -g @openfn/clix`

## Testing the release CLI

You can test the built CLI package to ensure it works before publishing it.

The `build/pack-local` script is an overly complicated solution which:

- Packs all the openfn packages
- Updates the dependencies to use peer packages in dist, rather than module names
- Creates `openfn-cli-<version>-local.tgz` which you can install globally.

To run the test:

```
$ pnpm build
$ pnpm clean:local
$ pnpm pack:local
```

Run the install command as printed in your shell - something like `npm -g dist/openfn-cli-local.tgz`

You can run `openfn test` to exercise the runtime and compiler.

## Building into Lightning

Some components are designed to be run from inside Lightning.

To test a local package without publishing it to npm, run:

```
pnpm export adaptor-docs
```

This will build adaptor-docs into a tarball and install it directly into Lightning (assuming that `Lightning` is a sibling dir of `kit`).

## Code Formatting with Prettier

[Prettier](https://prettier.io/) ensures consistent code style throughout the project.

### Editor Integration

Install the Prettier extension for your code editor to enable automatic formatting on save:

- **Visual Studio Code**: Install the "Prettier - Code formatter" extension.

### Manual Formatting

You can manually format files using Prettier by running:

```bash
pnpm run format
```
