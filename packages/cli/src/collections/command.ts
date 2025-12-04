import yargs from 'yargs';
import * as o from '../options';
import type { Opts } from '../options';
import { build, ensure, override } from '../util/command-builders';

export type QueryOptions = {
  createdBefore?: string;
  createdAfter?: string;
  updatedBefore?: string;
  updatedAfter?: string;
};

export type CollectionsOptions = Pick<Opts, 'log' | 'logJson'> & {
  endpoint?: string;
  token?: string;
  key: string;
  collectionName: string;
};

export type GetOptions = CollectionsOptions &
  QueryOptions &
  Pick<Opts, 'outputPath' | 'outputStdout'> & {
    pageSize?: number;
    limit?: number;
    pretty?: boolean;
  };

export type RemoveOptions = CollectionsOptions &
  QueryOptions & {
    dryRun?: boolean;
  };

export type SetOptions = CollectionsOptions & {
  items?: string;
  value?: string;
};

const desc = `Read and write from the OpenFn Collections API`;

export default {
  command: 'collections <subcommand>',
  describe: desc,
  builder: (yargs) =>
    yargs
      .command(get)
      .command(set)
      .command(remove)
      .example(
        '$0 collections get my-collection 2024* -o /tmp/output.json',
        'Get all keys from my-collection starting with the string "2024" and output the results to file'
      )
      .example(
        '$0 collections set my-collection my-key path/to/value.json',
        'Set a single key in my-collection to the contents of value.json'
      )
      .example(
        '$0 collections set my-collection --items path/to/items.json',
        'Set multiple key/value pairs from items.json to my-collection'
      )
      .example(
        '$0 collections remove my-collection my-key',
        'Remove a single key from my-collection'
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
    type: 'string',
    demand: true,
  },
  ensure: (opts: Partial<CollectionsOptions>) => {
    if (opts.key && typeof opts.key !== 'string') {
      opts.key = `${opts.key}`;
    }
  },
};

const token = {
  name: 'pat',
  yargs: {
    alias: ['token'],
    description: 'Lightning Personal Access Token (PAT)',
  },
};

const endpoint = {
  name: 'endpoint',
  yargs: {
    alias: ['e', 'lightning'],
    description:
      'URL to OpenFn server. Defaults to OPENFN_ENDPOINT or https://app.openfn.org',
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

const createdBefore = {
  name: 'created-before',
  yargs: {
    description: 'Matches keys created before the start of the created data',
  },
};

const createdAfter = {
  name: 'created-after',
  yargs: {
    description: 'Matches keys created after the end of the created data',
  },
};
const updatedBefore = {
  name: 'updated-before',
  yargs: {
    description: 'Matches keys updated before the start of the created data',
  },
};

const updatedAfter = {
  name: 'updated-after',
  yargs: {
    description: 'Matches keys updated after the end of the created data',
  },
};

const getOptions = [
  collectionName,
  key,
  token,
  endpoint,
  pageSize,
  limit,
  pretty,

  createdBefore,
  createdAfter,
  updatedAfter,
  updatedBefore,

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
  endpoint,
  dryRun,

  createdBefore,
  createdAfter,
  updatedAfter,
  updatedBefore,

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
  override(key as any, {
    demand: false,
  }),
  token,
  endpoint,
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
