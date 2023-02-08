import test from 'ava';
import { statePath } from '../../src/options';
import { Opts } from '../../src/commands';

test('statePath defaults to undefined', (t) => {
  const opts = {} as Opts;

  statePath.ensure(opts);

  t.falsy(opts.statePath);
  t.assert(opts.statePath === undefined);
});

test('statePath ensure is a no-op', (t) => {
  const opts = {} as Opts;

  statePath.ensure(opts);

  t.deepEqual(opts, {});
})

test('statePath can be set to a value', (t) => {
  const path = 'a/b/c.json';
  const opts = {
    statePath: path,
  } as Opts;

  statePath.ensure(opts);

  t.is(opts.statePath, path);
});

