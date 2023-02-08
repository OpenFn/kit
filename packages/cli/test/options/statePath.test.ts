import test from 'ava';
import { statePath as createOption } from '../../src/options';
import { Opts } from '../../src/commands';

const statePath = createOption();

test('statePath defaults to undefined', (t) => {
  const opts = {} as Opts;

  statePath.ensure(opts);

  t.falsy(opts.statePath);
  t.assert(opts.statePath === undefined);
});

test('statePath can be set to a value', (t) => {
  const path = 'a/b/c.json';
  const opts = {
    statePath: path,
  } as Opts;

  statePath.ensure(opts);

  t.is(opts.statePath, path);
});

