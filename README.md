Lightning ProjectSpace
======================

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/OpenFn/kit/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/OpenFn/kit/tree/main)

## Installing

- Install [`pnpm`](https://pnpm.io/installation)
- Run `pnpm run setup`
- Run `pnpm run build`

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

To relase to npm:

1) Update versions
```
pnpm changeset version
```

This will automatically update the version numbers of the affected packages.

2) Rebuild
```
pnpm install
```


(3a Test? Sanity check? Review?) 

3) Publish

```
pnmp publish -r
```

## Testing the built package

You can test the built CLI package to ensure it works before publishing it.

The `build/pack-local` script is an overly complicated solution which:
* Packs all the openfn packages
* Updates the dependencies to use peer packages in dist, rather than module names
* Creates `openfn-cli-<version>-local.tgz` which you can install globally.

To run the test:

```
$ pnpm build
$ pnpm clean:local
$ pnpm pack:local
```

Run the install command as printed in your shell - something like `npm -g dist/openfn-cli-local.tgz`

You can run `openfn --test` to exercise the runtime and compiler.


## Packages

- [`@openfn/describe-package`](packages/describe-package)  
- [`@openfn/workflow-diagram`](packages/workflow-diagram)

## Examples

The example apps serve to illustrate how these packages can be used, and also
for development, any changes detected in the dependencies will trigger a rebuild in the example.

**ProjectSpace Flow**

```
pnpm run -C examples/flow start
```

**Compiler Worker**

```
pnpm run -C examples/compiler-worker start
```

## Running Tests

```
pnpm run test
```

## Documentation

For information on the history of the OpenFn internals and ideas for the future
see [docs/future](docs/future).


