import test from 'ava';
import { compile } from '../../src/options';
import { Opts } from '../../src/commands';

test('compile defaults to true', (t) => {
  const opts = {} as Opts;

  compile.ensure(opts);

  t.true(opts.compile)
});

test('compile can be set to false', (t) => {
  const opts = {
    compile: false
  } as Opts;

  compile.ensure(opts);

  t.false(opts.compile)
});

