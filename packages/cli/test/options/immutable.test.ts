import test from 'ava';
import { immutable as createOption } from '../../src/options';
import { Opts } from '../../src/commands';

const immutable = createOption();

test('immutable defaults to false', (t) => {
  const opts = {} as Opts;

  immutable.ensure(opts);

  t.false(opts.immutable)
});

test('immutable can be set to true', (t) => {
  const opts = {
    immutable: true
  } as Opts;

  immutable.ensure(opts);

  t.true(opts.immutable)
});

