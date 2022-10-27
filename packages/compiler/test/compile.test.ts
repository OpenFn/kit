import test from 'ava';
import fs from 'node:fs/promises';
import path from 'node:path';
import compile from '../src/compile';

test('ensure default exports is created', (t) => {
  const source = '';
  const expected = 'export default [];';
  const result = compile(source);
  t.assert(result === expected);
});

test('do not add default exports if exports exist', (t) => {
  const source = 'export const x = 10;';
  const expected = 'export const x = 10;';
  const result = compile(source);
  t.assert(result === expected);
});

test('compile a single operation', (t) => {
  const source = 'fn();';
  const expected = 'export default [fn()];';
  const result = compile(source);
  t.assert(result === expected);
});

test('compile a single operation without being fussy about semicolons', (t) => {
  const source = 'fn()';
  const expected = 'export default [fn()];';
  const result = compile(source);
  t.assert(result === expected);
});

test('compile multiple operations', (t) => {
  const source = 'fn();fn();fn();';
  const expected = 'export default [fn(), fn(), fn()];';
  const result = compile(source);
  t.assert(result === expected);
});

test('add imports', (t) => {
  const options = {
    'add-imports': {
      adaptor: {
        name: '@openfn/language-common',
        exports: ['fn'],
      },
    },
  };
  const source = 'fn();';
  const expected = `import { fn } from "@openfn/language-common";\nexport default [fn()];`;
  const result = compile(source, options);
  t.assert(result === expected);
});

test('do not add imports', (t) => {
  const options = {
    'add-imports': {
      adaptor: {
        name: '@openfn/language-common',
        exports: ['fn'],
      },
    },
  };
  // This example already has the correct imports declared, so add-imports should do nothing
  const source = "import { fn } from '@openfn/language-common'; fn();";
  const expected = `import { fn } from '@openfn/language-common';\nexport default [fn()];`;
  const result = compile(source, options);
  t.assert(result === expected);
});

test('dumbly add imports', (t) => {
  const options = {
    'add-imports': {
      adaptor: {
        name: '@openfn/language-common',
      },
    },
  };
  // This example already has the correct imports declared, so add-imports should do nothing
  const source = "import { jam } from '@openfn/language-common'; jam(state);";
  const expected = `import { jam } from '@openfn/language-common';\nexport default [jam(state)];`;
  const result = compile(source, options);
  t.assert(result === expected);
});

test('add imports with export all', (t) => {
  const options = {
    'add-imports': {
      adaptor: {
        name: '@openfn/language-common',
        exports: ['fn'],
        exportAll: true,
      },
    },
  };
  const source = 'fn();';
  const expected = `import { fn } from "@openfn/language-common";\nexport * from "@openfn/language-common";\nexport default [fn()];`;
  const result = compile(source, options);
  t.assert(result === expected);
});

test('twitter example', async (t) => {
  const source = await fs.readFile(
    path.resolve('test/jobs/twitter.js'),
    'utf8'
  );
  // The expected source has been taken from a previous compilation
  // This is expected to change in future
  const expected = await fs.readFile(
    path.resolve('test/jobs/twitter.compiled.js'),
    'utf8'
  );
  const result = compile(source);
  t.deepEqual(result, expected);
});
