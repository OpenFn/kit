# OpenFn Kit

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/OpenFn/kit/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/OpenFn/kit/tree/main)

**Kit** _noun_ _/kɪt/_

A set of articles or equipment needed for a specific purpose.

1. _a football kit_
1. _the next-generation openfn data integration kit_

---

This repo contains runtime, tooling, libraries and components to support the next generation core openfn data integration pipeline.

It is a kitbag of Javascript-based components to support Lightning.

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

To release to npm:

1. Update versions

```
pnpm changeset version
```

This will automatically update the version numbers of the affected packages.

Commit the changes:

```
git commit -am "Updated changeset version"
```

2. Rebuild

```
pnpm install
pnpm build
```

3. Test

Build the test bundle:

```
$ pnpm clean:local
$ pnpm pack:local
```

Install using command reported by pack:local (`npm install -g dist/openfn-cli-<version>-local.tgz`)

Sanity check the version and ensure it works:

```
$ openfn --version
$ openfn test
```

3. Publish

```
pnpm changeset publish --otp <OTP>
```

4. Push tags

```
git push --follow-tags
```

## TypeSync

This repo uses `typesync` to ensure that all packages have an appropriate `@types/` package.

To manually run typesync, do `pnpm run typesync` from the repo root. Note that you'll have to `pnpm install` afterwards because typesync only updates dependency lists, it doesn't actually install them.

[TODO] typesync will run automatically when a new package is installed.

Note that @types packages only synchronise with the major and minor versions of a package. So for `@types/x@major.minor.patch`, `major` and `minor` refer to the versions of the corresponding package `x`, and `patch` is the verrsion number of the actual types package.

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

## Documentation

For information on the history of the OpenFn internals and ideas for the future
see [docs/future](docs/future).
