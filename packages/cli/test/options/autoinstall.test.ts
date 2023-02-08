import test from 'ava';
import { autoinstall } from '../../src/options';
import { Opts } from '../../src/commands';

test('autoinstall defaults to false', (t) => {
  const opts = {} as Opts;

  autoinstall.ensure(opts);

  t.false(opts.autoinstall)
});

test('autoinstall can be set to true', (t) => {
  const opts = {
    autoinstall: true
  } as Opts;

  autoinstall.ensure(opts);

  t.true(opts.autoinstall)
});

