import test from 'ava';
import { outputStdout } from '../../src/options';
import { Opts } from '../../src/commands';

test('outputStdout defaults to false', (t) => {
  const opts = {} as Opts;

  outputStdout.ensure(opts);

  t.false(opts.outputStdout)
});

test('outputStdout can be set to true', (t) => {
  const opts = {
    outputStdout: true
  } as Opts;

  outputStdout.ensure(opts);

  t.true(opts.outputStdout)
});

