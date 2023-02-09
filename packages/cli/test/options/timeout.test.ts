import test from 'ava';
import { timeout } from '../../src/options';
import { Opts } from '../../src/commands';

test('timeout defaults to 5 minutes', (t) => {
  const opts = {} as Opts;

  timeout.ensure(opts);

  t.is(opts.timeout, 300000)
});

test('timeout can be set to a value', (t) => {
  const opts = {
    timeout: 200
  } as Opts;

  timeout.ensure(opts);

  t.is(opts.timeout, 200)
});

