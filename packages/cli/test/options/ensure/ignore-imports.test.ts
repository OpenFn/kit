import test from 'ava';
import { ignoreImports, Opts, UnparsedOpts } from '../../../src/options';

test('do nothing if importImports is true (--ignore-imports)', (t) => {
  const opts = {
    ignoreImports: true,
  } as Opts;
  ignoreImports.ensure!(opts);

  t.true(opts.ignoreImports);
});

test('convert a single value to an array', (t) => {
  const opts = {
    ignoreImports: 'a',
  } as UnparsedOpts;
  ignoreImports.ensure!(opts);

  t.true(Array.isArray(opts.ignoreImports));
  const [a] = opts.ignoreImports as string[];
  t.is(a, 'a');
});

test('convert a single value to an array and trims', (t) => {
  const opts = {
    ignoreImports: '  a  ',
  } as UnparsedOpts;
  ignoreImports.ensure!(opts);

  t.true(Array.isArray(opts.ignoreImports));
  const [a] = opts.ignoreImports as string[];
  t.is(a, 'a');
});

test('convert multiple values to an array', (t) => {
  const opts = {
    ignoreImports: 'a, b, c',
  } as UnparsedOpts;
  ignoreImports.ensure!(opts);

  t.true(Array.isArray(opts.ignoreImports));
  const [a, b, c] = opts.ignoreImports as string[];
  t.is(a, 'a');
  t.is(b, 'b');
  t.is(c, 'c');
});
