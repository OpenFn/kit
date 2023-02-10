import test from 'ava';
import { expandAdaptors } from '../../src/options';
import { Opts } from '../../src/commands';

test('expandAdaptors defaults to true', (t) => {
  const opts = {} as Opts;

  expandAdaptors.ensure(opts);

  t.true(opts.expandAdaptors)
});

test('expandAdaptors can be set to false', (t) => {
  const opts = {
    expandAdaptors: false
  } as Opts;

  expandAdaptors.ensure(opts);

  t.false(opts.expandAdaptors)
});

