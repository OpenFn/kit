import test from 'ava';
import fs from 'node:fs/promises';
import path from 'node:path';
import compile from '../src/compile';

test('ensure default exports is created', (t) => {
  const source = '';
  const expected = 'export default [];';
  const result = compile(source);
  t.is(result, expected);
});

test('do not add default exports if exports exist', (t) => {
  const source = 'export const x = 10;';
  const expected = 'export const x = 10;';
  const result = compile(source);
  t.is(result, expected);
});

test('compile a single operation', (t) => {
  const source = 'fn();';
  const expected = 'export default [fn()];';
  const result = compile(source);
  t.is(result, expected);
});

test('compile a single namespaced operation', (t) => {
  const source = 'http.get();';
  const expected = 'export default [http.get()];';
  const result = compile(source);
  t.is(result, expected);
});

test('compile a const assignment with single method call', (t) => {
  const source = 'const x = dateFns.parse()';
  const expected = `const x = dateFns.parse()
export default [];`;
  const result = compile(source);
  t.is(result, expected);
});

test('compile a single operation without being fussy about semicolons', (t) => {
  const source = 'fn()';
  const expected = 'export default [fn()];';
  const result = compile(source);
  t.is(result, expected);
});

test('compile multiple operations', (t) => {
  const source = 'fn();fn();fn();';
  const expected = 'export default [fn(), fn(), fn()];';
  const result = compile(source);
  t.is(result, expected);
});

test('add imports', (t) => {
  const options = {
    'add-imports': {
      adaptors: [
        {
          name: '@openfn/language-common',
          exports: ['fn'],
        },
      ],
    },
  };
  const source = 'fn();';
  const expected = `import { fn } from "@openfn/language-common";\nexport default [fn()];`;
  const result = compile(source, options);
  t.is(result, expected);
});

test('do not add imports', (t) => {
  const options = {
    'add-imports': {
      adaptors: [
        {
          name: '@openfn/language-common',
          exports: ['fn'],
        },
      ],
    },
  };
  // This example already has the correct imports declared, so add-imports should do nothing
  const source = "import { fn } from '@openfn/language-common'; fn();";
  const expected = `import { fn } from '@openfn/language-common';\nexport default [fn()];`;
  const result = compile(source, options);
  t.is(result, expected);
});

test('dumbly add imports', (t) => {
  const options = {
    'add-imports': {
      adaptors: [
        {
          name: '@openfn/language-common',
        },
      ],
    },
  };
  // This example already has the correct imports declared, so add-imports should do nothing
  const source = "import { jam } from '@openfn/language-common'; jam(state);";
  const expected = `import { jam } from '@openfn/language-common';\nexport default [jam(state)];`;
  const result = compile(source, options);
  t.is(result, expected);
});

test('add imports with export all', (t) => {
  const options = {
    'add-imports': {
      adaptors: [
        {
          name: '@openfn/language-common',
          exports: ['fn'],
          exportAll: true,
        },
      ],
    },
  };
  const source = 'fn();';
  const expected = `import { fn } from "@openfn/language-common";\nexport * from "@openfn/language-common";\nexport default [fn()];`;
  const result = compile(source, options);
  t.is(result, expected);
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

test('compile with optional chaining', (t) => {
  const source = 'fn(a.b?.c);';
  const expected = 'export default [fn(a.b?.c)];';
  const result = compile(source);
  t.is(result, expected);
});

test('compile with nullish coalescence', (t) => {
  const source = 'fn(a ?? b);';
  const expected = 'export default [fn(a ?? b)];';
  const result = compile(source);
  t.is(result, expected);
});

test('compile a lazy state ($) expression', (t) => {
  const source = 'get($.data.endpoint);';
  const expected = 'export default [get(state => state.data.endpoint)];';
  const result = compile(source);
  t.is(result, expected);
});

test('compile a lazy state ($) expression with dumb imports', (t) => {
  const options = {
    'add-imports': {
      adaptors: [
        {
          name: '@openfn/language-common',
          exportAll: true,
        },
      ],
    },
  };
  const source = 'get($.data.endpoint);';
  const expected = `import { get } from "@openfn/language-common";
export * from "@openfn/language-common";
export default [get(state => state.data.endpoint)];`;

  const result = compile(source, options);
  t.is(result, expected);
});

test('compile simple promise chain', (t) => {
  const source =
    'get($.data.endpoint).then((s => { console.log(s.data); return state;} ));';

  const expected = `import { defer as _defer } from "@openfn/runtime";

export default [_defer(
  get(state => state.data.endpoint),
  p => p.then((s => { console.log(s.data); return state;} ))
)];`;

  const result = compile(source);
  t.is(result, expected);
});

test('compile simple promise chain with each', (t) => {
  const source = `each(
  "$.data[*]",
  post("/upsert", (state) => state.data).then((s) => s)
)`;

  const expected = `import { defer as _defer } from "@openfn/runtime";

export default [each(
  "$.data[*]",
  _defer(post("/upsert", (state) => state.data), p => p.then((s) => s))
)];`;

  const result = compile(source);
  t.is(result, expected);
});
