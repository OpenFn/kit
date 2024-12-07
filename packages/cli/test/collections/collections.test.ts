import test from 'ava';
import { mockFs, resetMockFs } from '../util';

import { get, set, remove } from '../../src/collections/handler';

// test the collections handlers directly

import { setGlobalDispatcher } from 'undici';
import { createMockLogger } from '@openfn/logger';
import { collections } from '@openfn/language-collections';
import { lightning } from '@openfn/lexicon';
import { readFile } from 'fs/promises';

// Log as json to make testing easier
const logger = createMockLogger('default', { level: 'debug', json: true });

const COLLECTION = 'test-collection-a';

let api: any;

// Load k/v pairs into the collection
// the id of each item is defaulted to the key
const loadData = (items: Record<string, object>) => {
  for (const key in items) {
    api.upsert(
      COLLECTION,
      key,
      JSON.stringify({
        id: key,
        ...items[key],
      })
    );
  }
};

test.before(() => {
  const client = collections.createMockServer('https://mock.openfn.org');
  api = client.api;
  setGlobalDispatcher(client.agent);
});

test.beforeEach(() => {
  logger._reset();
  api.reset();
  api.createCollection(COLLECTION);
  resetMockFs();
});

const createOptions = (opts = {}) => ({
  lightning: 'https://mock.openfn.org',
  collectionName: COLLECTION,
  key: '*',
  ...opts,
});

test.serial(
  'should get all keys from a collection and print to stdout',
  async (t) => {
    loadData({
      x: {},
      y: {},
    });
    const options = createOptions();
    await get(options, logger);

    // The last log should print the data out
    // (because we're logging to JSON we can easily inspect the raw JSON data)
    const [level, log] = logger._history.at(-1);
    t.deepEqual(log.message[0], {
      x: { id: 'x' },
      y: { id: 'y' },
    });
  }
);

test.serial(
  'should get all keys from a collection and write to disk',
  async (t) => {
    mockFs({
      '/tmp.json': '',
    });
    loadData({
      x: {},
      y: {},
    });
    const options = createOptions({
      outputPath: '/tmp.json',
    });
    await get(options, logger);

    const data = await readFile('/tmp.json');
    const items = JSON.parse(data);

    t.deepEqual(items, {
      x: { id: 'x' },
      y: { id: 'y' },
    });
  }
);
