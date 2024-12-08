import test from 'ava';
import { mockFs, resetMockFs } from '../util';

import { get, set, remove } from '../../src/collections/handler';

// test the collections handlers directly

import { setGlobalDispatcher } from 'undici';
import { createMockLogger } from '@openfn/logger';
import { collections } from '@openfn/language-collections';
import { readFile } from 'fs/promises';
import { lightning } from '@openfn/lexicon';

// Log as json to make testing easier
const logger = createMockLogger('default', { level: 'debug', json: true });

const COLLECTION = 'test-collection-a';
const ENDPOINT = 'https://mock.openfn.org';

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
  const client = collections.createMockServer(ENDPOINT);
  api = client.api;
  setGlobalDispatcher(client.agent);
});

test.beforeEach(() => {
  logger._reset();
  api.reset();
  api.createCollection(COLLECTION);
  loadData({
    x: {},
    y: {},
  });

  resetMockFs();
});

const createOptions = (opts = {}) => ({
  lightning: ENDPOINT,
  collectionName: COLLECTION,
  key: '*',
  token: 'x.y.z', // TODO need more tests around this
  ...opts,
});

test.serial('get all keys from a collection and print to stdout', async (t) => {
  const options = createOptions({
    key: '*',
  });
  await get(options, logger);

  // The last log should print the data out
  // (because we're logging to JSON we can easily inspect the raw JSON data)
  const [_level, log] = logger._history.at(-1);
  t.deepEqual(log.message[0], {
    x: { id: 'x' },
    y: { id: 'y' },
  });
});

test.serial('get one key from a collection and print to stdout', async (t) => {
  const options = createOptions({
    key: 'x',
  });
  await get(options, logger);

  // The last log should print the data out
  // (because we're logging to JSON we can easily inspect the raw JSON data)
  const [_level, log] = logger._history.at(-1);
  t.deepEqual(log.message[0], {
    id: 'x',
  });
});

test.serial('get all keys from a collection and write to disk', async (t) => {
  mockFs({
    '/tmp.json': '',
  });
  const options = createOptions({
    key: '*',
    outputPath: '/tmp.json',
  });
  await get(options, logger);

  const data = await readFile('/tmp.json');
  const items = JSON.parse(data);

  t.deepEqual(items, {
    x: { id: 'x' },
    y: { id: 'y' },
  });
});

test.serial('get one key from a collection and write to disk', async (t) => {
  mockFs({
    '/tmp.json': '',
  });
  const options = createOptions({
    key: 'x',
    outputPath: '/tmp.json',
  });
  await get(options, logger);

  const data = await readFile('/tmp.json');
  const items = JSON.parse(data);

  t.deepEqual(items, {
    id: 'x',
  });
});

// TODO item doesn't exist
// TODO no matching values

// TODO test that limit actually works
// TODO test that query filters actually work (mock doesn't support this)

test.serial('set a single value', async (t) => {
  mockFs({
    '/value.json': JSON.stringify({ id: 'z' }),
  });
  const options = createOptions({
    key: 'z',
    value: '/value.json',
  });

  await set(options, logger);

  t.is(api.count(COLLECTION), 3);
  const item = api.asJSON(COLLECTION, 'z');
  t.deepEqual(item, { id: 'z' });
});

test.serial('set multiple values', async (t) => {
  mockFs({
    '/items.json': JSON.stringify({
      a: { id: 'a' },
      b: { id: 'b' },
    }),
  });
  const options = createOptions({
    key: 'z',
    items: '/items.json',
  });

  await set(options, logger);

  t.is(api.count(COLLECTION), 4);
  const a = api.asJSON(COLLECTION, 'a');
  t.deepEqual(a, { id: 'a' });

  const b = api.asJSON(COLLECTION, 'b');
  t.deepEqual(b, { id: 'b' });
});

test.serial('set should throw if key and items are both set', async (t) => {
  const options = createOptions({
    key: 'z',
    items: '/value.json',
  });
  try {
    await set(options, logger);
  } catch (e) {
    t.regex(e.reason, /argument_error/i);
    t.regex(e.help, /do not pass a key/i);
  }
});

test.serial('remove one key', async (t) => {
  const itemBefore = api.byKey(COLLECTION, 'x');
  t.truthy(itemBefore);

  const options = createOptions({
    key: 'x',
  });

  await remove(options, logger);

  const itemAfter = api.byKey(COLLECTION, 'x');
  t.falsy(itemAfter);
});

test.serial('remove multiple keys', async (t) => {
  t.is(api.count(COLLECTION), 2);

  const options = createOptions({
    key: '*',
  });

  await remove(options, logger);

  t.is(api.count(COLLECTION), 0);
});

test.serial('remove with dry run', async (t) => {
  t.is(api.count(COLLECTION), 2);

  const options = createOptions({
    key: '*',
    dryRun: true,
  });

  await remove(options, logger);

  t.is(api.count(COLLECTION), 2);

  // Find the outputted keys
  const [_level, output] = logger._history.find(([level]) => level === 'print');
  t.deepEqual(output.message[0], ['x', 'y']);
});

// These tests are against the request helper code and should be common to all verbs

test.serial('should throw if the server is not available', async (t) => {
  const options = createOptions({
    key: 'x',
    lightning: 'https://www.blah.blah.blah',
  });
  try {
    await get(options, logger);
  } catch (e: any) {
    t.regex(e.reason, /connection_refused/i);
    t.regex(e.help, /correct url .+ --lightning/i);
  }
});

test.serial("should throw if a collection doesn't exist", async (t) => {
  const options = createOptions({
    key: 'x',
    collectionName: 'strawberries',
  });
  try {
    await get(options, logger);
  } catch (e: any) {
    t.regex(e.reason, /collection not found/i);
    t.regex(e.help, /ensure the collection has been created/i);
  }
});

test.serial('use OPENFN_ENDPOINT if lightning option is not set', async (t) => {
  const options = createOptions({
    key: 'x',
    lightning: undefined,
  });
  process.env.OPENFN_ENDPOINT = ENDPOINT;

  await get(options, logger);

  const [_level, log] = logger._history.at(-1);
  t.deepEqual(log.message[0], {
    id: 'x',
  });

  delete process.env.OPENFN_ENDPOINT;
});
