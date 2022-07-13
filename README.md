Lightning ProjectSpace
======================

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/OpenFn/kit/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/OpenFn/kit/tree/main)

## Installing

- Install [`pnpm`](https://pnpm.io/installation)
- Run `pnpm run setup`
- Run `pnpm run build`

## Packages

- [`@openfn/compiler`](packages/compiler)  
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
