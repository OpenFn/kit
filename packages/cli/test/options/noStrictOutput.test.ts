import test from 'ava';
import { strictOutput } from '../../src/options';
import { Opts } from '../../src/commands';

test('strictOutput defaults to true', (t) => {
  const opts = {} as Opts;

  strictOutput.ensure(opts);

  t.true(opts.strictOutput)
});

test('strictOutput can be set to false', (t) => {
  const opts = {
    strictOutput: false
  } as Opts;

  strictOutput.ensure(opts);

  t.false(opts.strictOutput)
});

// TODO this needs to go through yargs
// test('noStrictOutput can be set to true', (t) => {
//   const opts = {
//     strictOutput: false
//   } as Opts;

//   strictOutput.ensure(opts);

//   t.true(opts.strictOutput)
// });

