import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure, override } from '../util/command-builders';

export type CollectionsOptions = Pick<
  Opts,
  'log' | 'logJson' | 'outputPath' | 'outputStdout'
> & {
  lightning?: string;
  token?: string;
  pageSize?: number;
  limit?: number;
  key: string;
  collectionName: string;
  pretty?: boolean;
};

const desc = `Call out to the Collections API on Lightning`;

export default {
  command: 'collections [subcommand]',
  describe: desc,
  builder: (yargs) =>
    yargs
      .command(get)
      .example(
        'collections get my-collection 2024* -O',
        'Get all keys from my-collection starting with the string "2024" and log the results to stdout'
      ),
} as yargs.CommandModule<{}>;

// Since these options only apply to collections,
// Let's not declare them centrally, but keep them here
const collectionName = {
  name: 'collection-name',
  yargs: {
    alias: ['name'],
    description: 'Name of the collection to fetch from',
    demand: true,
  },
};

const key = {
  name: 'key',
  yargs: {
    description: 'Key or key pattern to retrieve',
    demand: true,
  },
};

// TODO this should default from env
// TODO this is used by other args
const token = {
  name: 'pat',
  yargs: {
    alias: ['token'],
    description: 'Lightning Personal Access Token (PAT)',
  },
};

const lightningUrl = {
  name: 'lightning',
  yargs: {
    description: 'URL to Lightning server',
  },
};

const pageSize = {
  name: 'page-size',
  yargs: {
    description: 'Number of items to fetch per page',
    type: 'number',
  },
};

// TODO not working yet
const limit = {
  name: 'limit',
  yargs: {
    description: 'Maximum number of items to download',
    type: 'number',
  },
};

const pretty = {
  name: 'pretty',
  yargs: {
    description: 'Prettify serialized output',
    type: 'boolean',
  },
};

const getOptions = [
  collectionName,
  key,
  token,
  lightningUrl,
  pageSize,
  limit,
  pretty,

  o.stateStdin,
  override(o.log, {
    default: 'info',
  }),
  o.logJson,
  {
    ...o.outputPath,
    // disable default output path behaviour
    ensure: () => {},
  },
];

export const get = {
  command: 'get name key',
  describe: 'Get values from a collection',
  handler: ensure('collections-get', getOptions),
  builder: (yargs) => build(getOptions, yargs),
} as yargs.CommandModule<{}>;

export const set = {
  command: 'set name [key] path',
  describe: 'Uploads values to a collection',
  handler: ensure('collections-get', getOptions),
  builder: (yargs) => build(getOptions, yargs),
} as yargs.CommandModule<{}>;
