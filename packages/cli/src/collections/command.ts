import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure, override } from '../util/command-builders';

export type CollectionsOptions = Pick<Opts, 'log' | 'logJson'> & {
  lightning?: string;
  token?: string;
  key: string;
  collectionName: string;
};

export type GetOptions = CollectionsOptions &
  Pick<Opts, 'outputPath' | 'outputStdout'> & {
    pageSize?: number;
    limit?: number;
    pretty?: boolean;
  };

export type RemoveOptions = CollectionsOptions & {
  dryRun?: boolean;
};

export type SetOptions = CollectionsOptions & {
  items?: string;
  value?: string;
};

const desc = `Call out to the Collections API on Lightning`;

export default {
  command: 'collections <subcommand>',
  describe: desc,
  builder: (yargs) =>
    yargs
      .command(get)
      .command(set)
      .command(remove)
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
  command: 'get <name> <key>',
  describe: 'Get values from a collection',
  handler: ensure('collections-get', getOptions),
  builder: (yargs) => build(getOptions, yargs),
} as yargs.CommandModule<{}>;

const dryRun = {
  name: 'dry-run',
  yargs: {
    description:
      '[Alpha] Do not delete keys and instead return the keys that would be deleted',
    type: 'boolean',
  },
};

const removeOptions = [
  collectionName,
  key,
  token,
  lightningUrl,
  dryRun,

  override(o.log, {
    default: 'info',
  }),
  o.logJson,
];

export const remove = {
  command: 'remove <name> <key>',
  describe: 'Remove values from a collection',
  handler: ensure('collections-remove', removeOptions),
  builder: (yargs) => build(removeOptions, yargs),
} as yargs.CommandModule<{}>;

const value = {
  name: 'value',
  yargs: {
    description: 'Path to the value to upsert',
  },
};

const items = {
  name: 'items',
  yargs: {
    description:
      'Path to a batch of items to upsert. Must contain a JSON object where each key is an item key, and each value is an uploaded value',
  },
};

const setOptions = [
  collectionName,
  // TODO in set, key does not support patterns
  // We should document and catch this case
  override(key, {
    demand: false,
  }),
  token,
  lightningUrl,
  value,
  items,

  override(o.log, {
    default: 'info',
  }),
  o.logJson,
];

export const set = {
  command: 'set <name> [key] [value] [--items]',
  describe: 'Uploads values to a collection. Must set key & value OR --items.',
  handler: ensure('collections-set', setOptions),
  builder: (yargs) =>
    build(setOptions, yargs)
      .example(
        'collections set my-collection cities-mapping ./citymap.json',
        'Upload the data in ./citymap.json to the cities-mapping key'
      )
      .example(
        'collections set my-collection --items ./items.json',
        'Upsert the object in ./items.json as a batch of items (key/value pairs)'
      ),
} as yargs.CommandModule<{}>;
