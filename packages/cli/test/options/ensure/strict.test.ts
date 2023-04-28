import test from 'ava';
import { strict, strictOutput, Opts } from '../../../src/options';

// Tests on legacy behaviour
test('strictOutput: true should set strict', (t) => {
  const opts = {
    strictOutput: true,
  } as Opts;
  strictOutput.ensure!(opts);
  t.true(opts.strict);
  // @ts-ignore
  t.falsy(opts.strictOutput);
});

test('strictOutput: false should set strict', (t) => {
  const opts = {
    strictOutput: false,
  } as Opts;
  strictOutput.ensure!(opts);
  t.false(opts.strict);
  // @ts-ignore
  t.falsy(opts.strictOutput);
});

test('strict should default to true', (t) => {
  const opts = {} as Opts;
  strict.ensure!(opts);
  t.true(opts.strict);
});

test('strict can be set to false', (t) => {
  const opts = {
    strict: false,
  } as Opts;
  strict.ensure!(opts);
  t.false(opts.strict);
});

test('strict overrides strictOutput', (t) => {
  const opts = {
    strictOutput: false,
    strict: true,
  } as Opts;

  // Note that the order of these two is important
  strict.ensure!(opts);
  strictOutput.ensure!(opts);

  t.true(opts.strict);
  t.falsy(opts.strictOutput);
});
