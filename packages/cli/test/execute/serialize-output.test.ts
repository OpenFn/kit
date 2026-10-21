import test from 'ava';
import { mockFs, restoreFs } from '@openfn/test-helpers';
import { readFile } from 'node:fs/promises';

import serializeOutput from '../../src/execute/serialize-output';
import { createMockLogger } from '@openfn/logger';

test.afterEach(restoreFs);

const logger = createMockLogger(undefined, { level: 'debug' });

test.beforeEach(() => {
  logger._reset();
});

const toString = (obj: object) => JSON.stringify(obj, null, 2);

test.serial('output true', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    true,
    logger
  );
  t.is(result, 'true');
});

test.serial('output false', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    false,
    logger
  );
  t.is(result, 'false');
});

test.serial('output a number', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    42,
    logger
  );
  t.is(result, '42');
});

test.serial('output null', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    null,
    logger
  );
  t.is(result, 'null');
});

test.serial('output undefined as an empty string', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    undefined,
    logger
  );
  t.is(result, '');
});

test.serial('output a string', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    'ok',
    logger
  );
  t.is(result, '"ok"');
});

test.serial('output an array', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    ['ok'],
    logger
  );
  t.is(result, toString(['ok']));
});

test.serial('output an object', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    {},
    logger
  );
  t.is(result, '{}');
});

test.serial('exclude configuration', async (t) => {
  const result = await serializeOutput(
    {
      outputStdout: true,
    },
    {
      data: {},
      configuration: {},
      foo: 'bar',
      _secret: true,
    },
    logger
  );
  t.is(result, toString({ data: {}, foo: 'bar', _secret: true }));
});

test.serial('output to file', async (t) => {
  mockFs({
    'out.json': '',
  });

  const before = await readFile('out.json', 'utf8');
  t.falsy(before);

  await serializeOutput(
    {
      outputPath: 'out.json',
    },
    {
      data: 1,
    },
    logger
  );

  const after = await readFile('out.json', 'utf8');
  t.is(after, toString({ data: 1 }));
});
