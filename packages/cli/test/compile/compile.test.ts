import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import compile, {
  stripVersionSpecifier,
  loadTransformOptions,
  resolveSpecifierPath,
} from '../../src/compile/compile';
import { CompileOptions } from '../../src/compile/command';
import { mockFs, resetMockFs } from '../util';
import { ExecutionPlan, Job } from '@openfn/lexicon';

const mockLog = createMockLogger();

test.after(resetMockFs);

const expressionPath = '/job.js';

type TransformOptionsWithImports = {
  ['add-imports']: {
    ignore: true | string[];
    adaptor: {
      name: string;
      exports: string[];
    };
  };
};

// TODO this isn't really used and is a bit of a quirky thing
// The compiler itself probably doesn't do any path parsing?
// Just compile a source string and return the result
test('compile from source string', async (t) => {
  const job = 'x();';

  const opts = {} as CompileOptions;

  const result = await compile(job, opts, mockLog);

  const expected = 'export default [x()];';
  t.is(result, expected);
});

test.serial('compile from path', async (t) => {
  const job = 'x();';
  mockFs({
    [expressionPath]: job,
  });

  const opts = {
    expressionPath,
  } as CompileOptions;

  const result = await compile(expressionPath, opts, mockLog);

  const expected = 'export default [x()];';
  t.is(result, expected);
});

test('compile from execution plan', async (t) => {
  const plan = {
    workflow: {
      steps: [
        { id: 'a', expression: 'x()' },
        { id: 'b', expression: 'x()' },
      ],
    },
    options: {},
  } as ExecutionPlan;

  const opts = {} as CompileOptions;

  const result = (await compile(plan, opts, mockLog)) as ExecutionPlan;

  const expected = 'export default [x()];';
  const [a, b] = result.workflow.steps;
  t.is((a as Job).expression, expected);
  t.is((b as Job).expression, expected);
});

test('throw an AbortError if a job is uncompilable', async (t) => {
  const job = 'a b';

  const opts = {} as CompileOptions;

  const logger = createMockLogger();
  await t.throwsAsync(() => compile(job, opts, logger), {
    message: 'Failed to compile job',
  });

  t.assert(logger._find('error', /unexpected token/i));
  t.assert(logger._find('always', /check the syntax of the job expression/i));
  t.assert(logger._find('error', /critical error: aborting command/i));
});

test('throw an AbortError if an xplan contains an uncompilable job', async (t) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: [{ id: 'a', expression: 'x b' }],
    },
    options: {},
  };

  const opts = {} as CompileOptions;

  const logger = createMockLogger();
  await t.throwsAsync(() => compile(plan, opts, logger), {
    message: 'Failed to compile job a',
  });

  t.assert(logger._find('error', /unexpected token/i));
  t.assert(logger._find('always', /check the syntax of the job expression/i));
  t.assert(logger._find('error', /critical error: aborting command/i));
});

test('stripVersionSpecifier: remove version specifier from @openfn', (t) => {
  const specifier = '@openfn/language-common@3.0.0-rc2';
  const transformed = stripVersionSpecifier(specifier);
  const expected = '@openfn/language-common';
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
  const specifier = '@openfn/language-common';
  const transformed = stripVersionSpecifier(specifier);
  const expected = '@openfn/language-common';
  t.assert(transformed == expected);
});

test('loadTransformOptions: do nothing', async (t) => {
  const opts = {};
  const result = loadTransformOptions(opts, mockLog);
  t.assert(JSON.stringify(result) === '{}');
});

test.serial(
  "resolveSpecifierPath: return null if the module can't be resolved locally",
  async (t) => {
    mock({
      '/repo': {},
    });
    const path = await resolveSpecifierPath('pkg', '/repo', mockLog);
    t.assert(path === null);
  }
);

test('resolveSpecifierPath: return a relative path if passed', async (t) => {
  const path = await resolveSpecifierPath('pkg=./a', '/repo', mockLog);
  t.assert(path === './a');
});

test('resolveSpecifierPath: return an absolute path if passed', async (t) => {
  const path = await resolveSpecifierPath('pkg=/a', '/repo', mockLog);
  t.assert(path === '/a');
});

test('resolveSpecifierPath: return a path if passed', async (t) => {
  const path = await resolveSpecifierPath('pkg=a/b/c', '/repo', mockLog);
  t.assert(path === 'a/b/c');
});

test('resolveSpecifierPath: basically return anything after the =', async (t) => {
  const path = await resolveSpecifierPath('pkg=a', '/repo', mockLog);
  t.assert(path === 'a');

  const path2 = await resolveSpecifierPath('pkg=@', '/repo', mockLog);
  t.assert(path2 === '@');

  const path3 = await resolveSpecifierPath('pkg=!', '/repo', mockLog);
  t.assert(path3 === '!');
});

test.serial(
  'resolveSpecifierPath: return a path to the repo if the module is found',
  async (t) => {
    mock({
      '/repo/package.json': JSON.stringify({
        name: 'repo',
        dependencies: {
          'pkg_1.0.0': 'npm:pkg@1.0.0',
        },
      }),
    });
    const path = await resolveSpecifierPath('pkg', '/repo', mockLog);
    t.assert(path === '/repo/node_modules/pkg_1.0.0');
  }
);

test.serial(
  'resolveSpecifierPath: return null if a module is not in the repo',
  async (t) => {
    mock({
      '/repo/package.json': JSON.stringify({
        name: 'repo',
        dependencies: {
          'pkg_1.0.0': 'npm:pkg@1.0.0',
        },
      }),
    });
    const path = await resolveSpecifierPath('wibble', '/repo', mockLog);
    t.assert(path === null);
  }
);

test.serial(
  'loadTransformOptions: describes imports from an explicit path',
  async (t) => {
    mock({
      '/modules/': mock.load(path.resolve('test/__modules__/'), {}),
    });
    const opts = {
      // This should find the times-two module in test/__modules__
      adaptors: ['times-two=/modules/times-two'],
    } as CompileOptions;

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
    } as CompileOptions;
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
  'loadTransformOptions: describes imports from a relative path in the repo',
  async (t) => {
    mock({
      '/repo/': mock.load(path.resolve('test/__repo__/'), {}),
    });
    const opts = {
      adaptors: ['times-two'],
      repoDir: '/repo/',
    } as CompileOptions;

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

test.serial('loadTransformOptions: ignore imports', async (t) => {
  const opts = {
    ignoreImports: true,
    adaptors: ['times-two'],
    repoDir: '/repo/',
  } as CompileOptions;

  const result = (await loadTransformOptions(
    opts,
    mockLog
  )) as TransformOptionsWithImports;

  t.falsy(result['add-imports']);
});

test.serial('loadTransformOptions: ignore some imports', async (t) => {
  const opts = {
    ignoreImports: ['a'],
    adaptors: ['times-two'],
    repoDir: '/repo/',
  } as CompileOptions;

  const result = (await loadTransformOptions(
    opts,
    mockLog
  )) as TransformOptionsWithImports;

  t.truthy(result['add-imports']);
  const { ignore } = result['add-imports'];
  t.deepEqual(ignore, ['a']);
});

// TODO test exception if the module can't be found
