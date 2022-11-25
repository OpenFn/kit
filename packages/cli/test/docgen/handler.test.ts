// Test the actual functionality of docgen
// ie, generate docs to a mock folder
import test from 'ava';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import mockfs from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import docsHandler, {
  DocGenFn,
  generatePlaceholder,
} from '../../src/docgen/handler';

const logger = createMockLogger();

const REPO_PATH = '/tmp/repo';
const DOCS_PATH = `${REPO_PATH}/docs`;

test.beforeEach(() => {
  mockfs.restore();
  logger._reset();
  mockfs({
    [DOCS_PATH]: {},
  });
});

const loadJSON = async (path: string) => {
  try {
    const result = await fs.readFile(path, 'utf8');
    if (result) {
      return JSON.parse(result);
    }
  } catch (e) {}
};

// Mock doc gen function
const mockGen: DocGenFn = async () => ({
  name: 'test',
  version: '1.0.0',
  functions: [
    {
      name: 'fn',
      description: 'a function',
      isOperation: true,
      magic: false,
      parameters: [],
      examples: [],
    },
  ],
});

const specifier = 'test@1.0.0';

const options = {
  specifier,
  repoDir: REPO_PATH,
};

test.serial('generate mock docs', async (t) => {
  const path = await docsHandler(options, logger, mockGen);
  t.is(path, `${DOCS_PATH}/${specifier}.json`);

  const docs = await loadJSON(path);

  t.is(docs.name, 'test');
  t.is(docs.version, '1.0.0');
});

// TODO ensure repo

test.serial('ensurePlaceholder', async (t) => {
  const path = `${DOCS_PATH}/${specifier}.json`;
  const empty = await loadJSON(path);
  t.falsy(empty);

  generatePlaceholder(path);

  const docs = await loadJSON(path);
  t.true(docs.loading);
  t.assert(typeof docs.timestamp === 'number');
});

test.serial('do not generate docs if they already exist', async (t) => {
  let docgenCalled = false;

  const docgen = (() => {
    docgenCalled = true;
    return {};
  }) as unknown as DocGenFn;

  mockfs({
    [`${DOCS_PATH}/${specifier}.json`]: '{ "name": "test" }',
  });

  const path = await docsHandler(options, logger, docgen);

  t.false(docgenCalled);
  t.is(path, `${DOCS_PATH}/${specifier}.json`);
});

test.serial('create a placeholder before generating the docs', async (t) => {
  const path = `${DOCS_PATH}/${specifier}.json`;

  // a placeholder should not exist when we start
  const empty = await loadJSON(path);
  t.falsy(empty);

  const docgen = (async () => {
    // When docgen is called, a placeholder should now exist
    const placeholder = await loadJSON(path);
    t.truthy(placeholder);
    t.true(placeholder.loading);
    t.assert(typeof placeholder.timestamp === 'number');

    return {};
  }) as unknown as DocGenFn;

  await docsHandler(options, logger, docgen);
});

test.serial(
  'synchronously create a placeholder before generating the docs',
  async (t) => {
    const path = `${DOCS_PATH}/${specifier}.json`;

    // a placeholder should not exist when we start
    const empty = await loadJSON(path);
    t.falsy(empty);

    const promise = docsHandler(options, logger, mockGen);
    // the placeholder should already be created

    const placeholder = JSON.parse(readFileSync(path, 'utf8'));
    t.truthy(placeholder);
    t.true(placeholder.loading);
    t.assert(typeof placeholder.timestamp === 'number');

    // politely wait for the promise to run
    await promise.then();
  }
);

test.serial('wait for docs if a placeholder is present', async (t) => {
  const path = `${DOCS_PATH}/${specifier}.json`;

  mockfs({
    [path]: `{ "loading": true, "timestamp": ${Date.now()} }`,
  });

  // After 100ms generate some docs and write to the file
  setTimeout(async () => {
    const docs = await mockGen('x');
    fs.writeFile(path, JSON.stringify(docs));
  }, 60);

  let docgencalled = false;

  const docgen = (async () => {
    docgencalled = true;
    return {};
  }) as unknown as DocGenFn;

  await docsHandler(options, logger, docgen, 20);

  // It should not call out to this docgen function
  t.false(docgencalled);

  // docs should be present and correct
  const docs = await loadJSON(path);

  t.is(docs.name, 'test');
  t.is(docs.version, '1.0.0');
});
