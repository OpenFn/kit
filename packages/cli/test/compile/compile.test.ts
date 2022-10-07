import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import mockLogger from '@openfn/logger';
import {
  stripVersionSpecifier,
  loadTransformOptions,
} from '../../src/compile/compile';
import type { SafeOpts } from '../../src/commands';

const mockLog = mockLogger();

test.afterEach(() => {
  mock.restore();
});

type TransformOptionsWithImports = {
  ['add-imports']: {
    adaptor: {
      name: string;
      exports: string[];
    };
  };
};

test('stripVersionSpecifier: remove version specifier from @openfn', (t) => {
  const specifier = '@openfn/language-commmon@3.0.0-rc2';
  const transformed = stripVersionSpecifier(specifier);
  const expected = '@openfn/language-commmon';
  t.assert(transformed == expected);
});

test('stripVersionSpecifier: remove version specifier from arbitrary package', (t) => {
  const specifier = 'ava@1.0.0';
  const transformed = stripVersionSpecifier(specifier);
  const expected = 'ava';
  t.assert(transformed == expected);
});

test('stripVersionSpecifier: remove version specifier from arbitrary namespaced package', (t) => {
  const specifier = '@ava/some-pkg@^1';
  const transformed = stripVersionSpecifier(specifier);
  const expected = '@ava/some-pkg';
  t.assert(transformed == expected);
});

test("stripVersionSpecifier: do nothing if there's no specifier", (t) => {
  const specifier = '@openfn/language-commmon';
  const transformed = stripVersionSpecifier(specifier);
  const expected = '@openfn/language-commmon';
  t.assert(transformed == expected);
});

test('loadTransformOptions: do nothing', async (t) => {
  const opts = {} as SafeOpts;
  const result = loadTransformOptions(opts, mockLog);
  t.assert(JSON.stringify(result) === '{}');
});

test.serial(
  'loadTransformOptions: describes imports from an explicit path',
  async (t) => {
    mock({
      '/modules/': mock.load(path.resolve('test/__modules__/'), {}),
    });
    const opts = {
      // This should find the times-two module in test/__modules__
      adaptors: ['times-two=/modules/times-two'],
    } as SafeOpts;

    const result = (await loadTransformOptions(
      opts,
      mockLog
    )) as TransformOptionsWithImports;
    t.truthy(result['add-imports']);

    // Should describe the exports of the times-two module
    const { name, exports } = result['add-imports'].adaptor;
    t.assert(name === 'times-two');
    t.assert(exports.includes('byTwo'));
  }
);

test.serial(
  'loadTransformOptions: describes imports from an explicit path and version specifier',
  async (t) => {
    mock({
      '/modules/': mock.load(path.resolve('test/__modules__/'), {}),
    });
    const opts = {
      adaptors: ['times-two@1.0.0=/modules/times-two'],
    } as SafeOpts;

    const result = (await loadTransformOptions(
      opts,
      mockLog
    )) as TransformOptionsWithImports;
    t.truthy(result['add-imports']);

    // Should describe the exports of the times-two module
    const { name, exports } = result['add-imports'].adaptor;
    t.assert(name === 'times-two');
    t.assert(exports.includes('byTwo'));
  }
);

test.serial(
  'loadTransformOptions: describes imports from a relative path from modulesHome',
  async (t) => {
    mock({
      '/modules/': mock.load(path.resolve('test/__modules__/'), {}),
    });
    const opts = {
      adaptors: ['times-two'],
      modulesHome: '/modules/',
    } as SafeOpts;

    const result = (await loadTransformOptions(
      opts,
      mockLog
    )) as TransformOptionsWithImports;
    t.truthy(result['add-imports']);

    // Should describe the exports of the times-two module
    const { name, exports } = result['add-imports'].adaptor;
    t.assert(name === 'times-two');
    t.assert(exports.includes('byTwo'));
  }
);

// Note: this one will call out to unpkg... wouldn't mind mocking that out
test('loadTransformOptions: describes imports from unpkg', async (t) => {
  const opts = {
    adaptors: ['@openfn/language-common@2.0.0-rc3'],
  } as SafeOpts;

  const result = (await loadTransformOptions(
    opts,
    mockLog
  )) as TransformOptionsWithImports;

  const { name, exports } = result['add-imports'].adaptor;
  t.assert(name === '@openfn/language-common');
  t.assert(exports.includes('fn'));
  t.assert(exports.includes('combine'));
  t.assert(exports.includes('dataValue'));
  t.assert(exports.includes('field'));
});

// TODO test exception if the module can't be found
