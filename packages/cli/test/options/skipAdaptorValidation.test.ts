import test from 'ava';
import { skipAdaptorValidation } from '../../src/options';
import { Opts } from '../../src/commands';

test('skipAdaptorValidation defaults to false', (t) => {
  const opts = {} as Opts;

  skipAdaptorValidation.ensure(opts);

  t.false(opts.skipAdaptorValidation)
});

test('skipAdaptorValidation can be set to true', (t) => {
  const opts = {
    skipAdaptorValidation: true
  } as Opts;

  skipAdaptorValidation.ensure(opts);

  t.true(opts.skipAdaptorValidation)
});

