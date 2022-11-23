// Test the actual functionality of docgen
// ie, generate docs to a mock folder
import test from 'ava';
import fs from 'node:fs/promises';
import mockfs from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import docsHandler, { generatePlaceholder } from '../../src/docgen/handler';
import mock from 'mock-fs';

const logger = createMockLogger();

const REPO_PATH = '/tmp/repo';
const DOCS_PATH = `${REPO_PATH}/docs`;

test.beforeEach(() => {
  mockfs.restore();
  logger._reset();
  mock({
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
const mockGen = async () => ({
  name: 'test',
  version: '1.0.0',
  functions: [
    {
      name: 'fn',
      description: 'a function',
      isOperation: true,
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

  await generatePlaceholder(path);

  const docs = await loadJSON(path);
  t.true(docs.loading);
  t.assert(typeof docs.timestamp === 'number');
});

test.serial('do not generate docs if they already exist', async (t) => {
  let docgenCalled = false;
  const mockGen = () => {
    docgenCalled = true;
    return {};
  };
  mockfs({
    [`${DOCS_PATH}/${specifier}.json`]: '{ "name": "test" }',
  });

  const path = await docsHandler(options, logger, mockGen);

  t.false(docgenCalled);
  t.is(path, `${DOCS_PATH}/${specifier}.json`);
});

// TODO generate a placeholder before returning
// TODO wait if a placeholder exists
// TODO timeout if a placeholder exists
