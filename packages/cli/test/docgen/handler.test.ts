// Test the actual functionality of docgen
// ie, generate docs to a mock folder
import test from 'ava';
import { readFileSync, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import mockfs from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import docsHandler, { DocGenFn, ensurePath } from '../../src/docgen/handler';

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
const mockGen: DocGenFn = async () =>
  new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          namespaces: [{ type: 'namespace', name: 'smth' }],
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
              type: 'function',
            },
          ],
        }),
      300
    );
  });

const specifier = 'test@1.0.0';

const options = {
  specifier,
  repoDir: REPO_PATH,
};

test.serial('generate mock docs', async (t) => {
  const path = (await docsHandler(options, logger, mockGen)) as string;
  t.is(path, `${DOCS_PATH}/${specifier}.json`);

  const docs = await loadJSON(path);

  t.is(docs.name, 'test');
  t.is(docs.version, '1.0.0');
});

test.serial('log the result path', async (t) => {
  await docsHandler(options, logger, mockGen);

  const { message } = logger._parse(logger._last);
  t.is(message, `  ${DOCS_PATH}/${specifier}.json`);
});

test.serial("ensurePath if there's no repo", (t) => {
  mockfs({
    ['/tmp']: {},
  });
  ensurePath('/tmp/repo/docs/x.json');

  t.true(existsSync('/tmp/repo/docs'));
});

test.serial("ensurePath if there's no docs folder", (t) => {
  mockfs({
    ['/tmp/repo']: {},
  });
  ensurePath('/tmp/repo/docs/x.json');

  t.true(existsSync('/tmp/repo/docs'));
});

test.serial("ensurePath if there's a namespace", (t) => {
  mockfs({
    ['/tmp']: {},
  });
  ensurePath('/tmp/repo/docs/@openfn/language-common.json');

  t.true(existsSync('/tmp/repo/docs/@openfn'));
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

    const placeholder = await loadJSON(path);
    t.truthy(placeholder);
    t.true(placeholder.loading);
    t.assert(typeof placeholder.timestamp === 'number');

    // politely wait for the promise to run
    await promise
      .then(() => {
        t.pass();
      })
      .catch(() => {
        t.fail();
      });
  }
);

test.serial("remove the placeholder if there's an error", async (t) => {
  const path = `${DOCS_PATH}/${specifier}.json`;

  const docgen = (async () => {
    // When docgen is called, a placeholder should now exist
    const placeholder = await loadJSON(path);
    t.truthy(placeholder);
    t.true(placeholder.loading);

    throw new Error('test');
  }) as unknown as DocGenFn;

  await docsHandler(options, logger, docgen);

  // placeholder should be gone
  const empty = await loadJSON(path);
  t.falsy(empty);
});

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

test.serial("throw there's a timeout", async (t) => {
  const path = `${DOCS_PATH}/${specifier}.json`;

  mockfs({
    [path]: `{ "loading": true, "timestamp": ${Date.now()} }`,
  });

  // This will timeout
  const timeout = 2;
  await t.throwsAsync(
    async () => docsHandler(options, logger, async () => {}, timeout),
    {
      message: 'Timed out waiting for docs to load',
    }
  );
});

test.serial("don't remove the placeholder if there's a timeout", async (t) => {
  const path = `${DOCS_PATH}/${specifier}.json`;

  mockfs({
    [path]: `{ "loading": true, "timestamp": ${Date.now()} }`,
  });

  const timeout = 2;
  await t.throwsAsync(
    async () => docsHandler(options, logger, async () => {}, timeout),
    {
      message: 'Timed out waiting for docs to load',
    }
  );

  // docs should be present and correct
  const placeholder = await loadJSON(path);

  t.truthy(placeholder);
  t.true(placeholder.loading);
});

test.serial("reset the placeholder if it's old", async (t) => {
  const path = `${DOCS_PATH}/${specifier}.json`;

  mockfs({
    [path]: `{ "loading": true, "test", true, "timestamp": ${
      Date.now() - 1001
    } }`,
  });

  let docgencalled = false;
  const docgen = (async (specifier: string) => {
    // a new timestamp should be generated
    const placeholder = await loadJSON(path);
    t.true(placeholder.loading);
    t.falsy(placeholder.test);

    docgencalled = true;
    return await mockGen(specifier);
  }) as DocGenFn;

  await docsHandler(options, logger, docgen);

  // It should call out to the docgen function
  t.true(docgencalled);

  // docs should be present and correct
  const docs = await loadJSON(path);

  t.is(docs.name, 'test');
  t.is(docs.version, '1.0.0');
});
