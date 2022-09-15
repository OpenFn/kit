import test from 'ava';

import compile from '../src/compile';

test('ensure default exports is created', (t) => {
  const source = ""
  const expected = "export default [];";
  const result = compile(source);
  t.assert(result === expected);
});

test('do not add default exports if exports exist', (t) => {
  const source = "export const x = 10;"
  const expected = "export const x = 10;";
  const result = compile(source);
  t.assert(result === expected);
});

test('compile a single operation', (t) => {
  const source = "fn();"
  const expected = "export default [fn()];";
  const result = compile(source);
  t.assert(result === expected);
});

test('compile a single operation without being fussy about semiclons', (t) => {
  const source = "fn()"
  const expected = "export default [fn()];";
  const result = compile(source);
  t.assert(result === expected);
});

test('compile multiple operations', (t) => {
  const source = "fn();fn();fn();"
  const expected = "export default [fn(), fn(), fn()];";
  const result = compile(source);
  t.assert(result === expected);
});

test('add imports', (t) => {
  const options = {
    'add-imports': {
      adaptor: {
        name: '@openfn/language-common',
        exports: ['fn']
      }
    }
  }
  const source = "fn();"
  const expected = `import { fn } from "@openfn/language-common";\nexport default [fn()];`;
  const result = compile(source, options);
  t.assert(result === expected);
});