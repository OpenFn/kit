import test from 'ava';
import { sanitize, Opts } from '../../../src/options';

test('ensure should do nothing for none', (t) => {
  const opts = {
    sanitize: 'none',
  } as Opts;
  sanitize.ensure!(opts);

  t.is(opts.sanitize, 'none');
});

test('ensure should do nothing for remove', (t) => {
  const opts = {
    sanitize: 'remove',
  } as Opts;
  sanitize.ensure!(opts);

  t.is(opts.sanitize, 'remove');
});

test('ensure should do nothing for summarize', (t) => {
  const opts = {
    sanitize: 'summarize',
  } as Opts;
  sanitize.ensure!(opts);

  t.is(opts.sanitize, 'summarize');
});

test('ensure should do nothing for obfuscate', (t) => {
  const opts = {
    sanitize: 'obfuscate',
  } as Opts;
  sanitize.ensure!(opts);

  t.is(opts.sanitize, 'obfuscate');
});

test('ensure should throw for unknown value', (t) => {
  const opts = {
    sanitize: 'no-thank-you',
  } as unknown as Opts;

  t.throws(() => sanitize.ensure!(opts));
});
