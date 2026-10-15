import test from 'ava';
import yargs from 'yargs';

import { command } from '../../src/projects/deploy';

const ENV = 'OPENFN_NO_CHECKOUT_AFTER_DEPLOY';
const original = process.env[ENV];

test.afterEach.always(() => {
  if (original === undefined) {
    delete process.env[ENV];
  } else {
    process.env[ENV] = original;
  }
});

// Parsing runs the command handler (ensure), so this returns the final options
const parse = (cmd: string) =>
  yargs()
    .command(command as any)
    .parse(cmd) as any;

test.serial('checkout defaults to true', (t) => {
  delete process.env[ENV];
  t.true(parse('deploy').checkout);
});

test.serial('env=true with no flag skips checkout', (t) => {
  process.env[ENV] = 'true';
  t.false(parse('deploy').checkout);
});

test.serial('env=true with --checkout checks out', (t) => {
  process.env[ENV] = 'true';
  t.true(parse('deploy --checkout').checkout);
});

test.serial('env=false with --no-checkout skips checkout', (t) => {
  process.env[ENV] = 'false';
  t.false(parse('deploy --no-checkout').checkout);
});

test.serial('env unset with --no-checkout skips checkout', (t) => {
  delete process.env[ENV];
  t.false(parse('deploy --no-checkout').checkout);
});
