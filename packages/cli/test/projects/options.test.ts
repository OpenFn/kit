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
  const options = parse('deploy');
  t.true(options.checkout);
});

test.serial('env=true with no flag skips checkout', (t) => {
  process.env[ENV] = 'true';
  const options = parse('deploy');
  t.false(options.checkout);
});

test.serial('env=false with no flag checks out', (t) => {
  process.env[ENV] = 'false';
  const options = parse('deploy');
  t.true(options.checkout);
});

test.serial('env=1 (truthy but not "true") with no flag checks out', (t) => {
  process.env[ENV] = '1';
  const options = parse('deploy');
  t.true(options.checkout);
});

test.serial('env=true with --checkout checks out', (t) => {
  process.env[ENV] = 'true';
  const options = parse('deploy --checkout');
  t.true(options.checkout);
});

test.serial('env=false with --no-checkout skips checkout', (t) => {
  process.env[ENV] = 'false';
  const options = parse('deploy --no-checkout');
  t.false(options.checkout);
});

test.serial('env unset with --no-checkout skips checkout', (t) => {
  delete process.env[ENV];
  const options = parse('deploy --no-checkout');
  t.false(options.checkout);
});
