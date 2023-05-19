## Deploy

A module providing facilities to interactively deploy projects and workflows to instances of OpenFn Lightning.

Given a project configuration file, a config file and optionally a state file, this module will:

- Create or update a project.
- Query for differences between local and remote state and confirm whether to deploy.

## Basic Usage

```js
import { readFile } from 'node:fs/promises';
import deploy from '@openfn/deploy';

const extraOptions = {};

await deploy(
  {
    project: await readFile('project.json', 'utf8'),
    config: await readFile('config.json', 'utf8'),
    state: await readFile('state.json', 'utf8'),
  },
  extraOptions
);
```

See the `test` folder for more usage examples.

The runtime provides no CLI. Use packages/cli (devtools) for this.

## Configuration

The deployment endpoints are configurable.

In all cases, you will need to provide an API token in order to identify yourself to the API.

The ability to set which endpoint you want to deploy to is useful for testing environments, but also for deploying to a local instance of OpenFn Lightning.

## State Files

State files are used to keep a reference between the keys used in the project files and the IDs of the remote objects.

In addition the file is used to keep track of the last deployed version of the project. This allows the deployment
to be checked for differences between the local and remote versions.

## Building

To build a js package into `dist/`, run:

```
$ pnpm build
```

To watch and re-build whenever the js changes, run

```
$ pnpm build:watch
```

Note: The watch throws an error on first run but seems to work.

You can test or watch tests with:

```
$ pnpm test
$ pnpm test:watch
```
