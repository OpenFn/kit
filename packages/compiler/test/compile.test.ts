import test from 'ava';

import compile from '../src/transform';

test('compile a single operation', (t) => {
  const source = "fn();"
  const expected = "export default [fn()]";
  const result = compile(source, { eval: true });
  t.assert(result === expected);
});

test('compile multiple operations', (t) => {
  const source = "fn();fn();fn()"
  const expected = "export default [fn(), fn(), fn()]";
  const result = compile(source, { eval: true });
  t.assert(result === expected);
});