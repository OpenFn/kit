import test from 'ava';
import mockfs from 'mock-fs';
import { readFile } from 'node:fs/promises';

import { handleOutput } from '../../src/execute/handler';
import { createMockLogger } from '@openfn/logger';

const logger = createMockLogger(undefined, { level: 'debug' });

test.beforeEach(() => {
  logger._reset();
});

const toString = (obj: object) => JSON.stringify(obj, null, 2);

test('output true', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    true,
    logger
  );
  t.true(result);
});

test('output false', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    false,
    logger
  );
  t.false(result);
});

test('output a number', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    42,
    logger
  );
  t.is(result, 42);
});

test('output null', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    null,
    logger
  );
  t.is(result, null);
});

test('output undefined', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    undefined,
    logger
  );
  t.is(result, undefined);
});

test('output a string', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    'ok',
    logger
  );
  t.is(result, 'ok');
});

test('output a an array', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    ['ok'],
    logger
  );
  t.deepEqual(result, ['ok']);
});

// TODO should return as string
test('output an object', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
    },
    {},
    logger
  );
  t.deepEqual(result, {});
});

test('strict-mode: only output data', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
      strictOutput: true,
    },
    {
      data: {},
      configuration: {},
      foo: 'bar',
      _secret: true,
    },
    logger
  );
  t.is(result, toString({ data: {} }));
});

test('strict-mode by default', async (t) => {
  const result = await handleOutput(
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
  t.is(result, toString({ data: {} }));
});

test('non-strict-mode: exclude configuration', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
      strictOutput: false,
    },
    {
      data: {},
      configuration: {},
    },
    logger
  );
  t.is(result, toString({ data: {} }));
});

test('non-strict-mode: include other stuff', async (t) => {
  const result = await handleOutput(
    {
      outputStdout: true,
      strictOutput: false,
    },
    {
      data: {},
      _secret: 'true',
    },
    logger
  );
  t.is(result, toString({ data: {}, _secret: 'true' }));
});

// TODO fails right now
test.skip('handle circular data', async (t) => {
  const a: any = { name: 'a' };
  a.rel = a;

  const result = await handleOutput(
    {
      outputStdout: true,
    },
    {
      data: a,
    },
    logger
  );
  t.is(result, toString({ data: {} }));
});

test('ignore fuctions', async (t) => {
  const a: any = { help: () => 'I need somebody' };

  const result = await handleOutput(
    {
      outputStdout: true,
    },
    {
      data: a,
    },
    logger
  );
  t.is(result, toString({ data: {} }));
});

test('output to file', async (t) => {
  mockfs({
    'out.json': '',
  });

  const before = await readFile('out.json', 'utf8');
  t.falsy(before);

  await handleOutput(
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
