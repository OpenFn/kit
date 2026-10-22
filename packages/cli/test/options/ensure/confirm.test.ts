import test from 'ava';
import { confirm, Opts } from '../../../src/options';

const ENV = 'OPENFN_NO_CONFIRM';
const original = process.env[ENV];

test.afterEach.always(() => {
  if (original === undefined) {
    delete process.env[ENV];
  } else {
    process.env[ENV] = original;
  }
});

test.serial('confirm defaults to true', (t) => {
  delete process.env[ENV];
  const opts = {} as Opts;
  confirm.ensure!(opts);

  t.true(opts.confirm);
});

test.serial('-y sets confirm to false', (t) => {
  delete process.env[ENV];
  const opts = { y: true } as unknown as Opts;
  confirm.ensure!(opts);

  t.false(opts.confirm);
});

test.serial('env=true with no flag sets confirm to false', (t) => {
  process.env[ENV] = 'true';
  const opts = {} as Opts;
  confirm.ensure!(opts);

  t.false(opts.confirm);
});

test.serial('env=false with no flag leaves confirm true', (t) => {
  process.env[ENV] = 'false';
  const opts = {} as Opts;
  confirm.ensure!(opts);

  t.true(opts.confirm);
});

test.serial(
  'env=1 (truthy but not "true") with no flag leaves confirm true',
  (t) => {
    process.env[ENV] = '1';
    const opts = {} as Opts;
    confirm.ensure!(opts);

    t.true(opts.confirm);
  }
);

test.serial('env=true with an explicit --confirm leaves confirm true', (t) => {
  process.env[ENV] = 'true';
  const opts = { confirm: true } as Opts;
  confirm.ensure!(opts);

  t.true(opts.confirm);
});

test.serial('env unset with --no-confirm sets confirm to false', (t) => {
  delete process.env[ENV];
  const opts = { confirm: false } as Opts;
  confirm.ensure!(opts);

  t.false(opts.confirm);
});
