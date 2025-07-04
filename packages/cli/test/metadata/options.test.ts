import test from 'ava';
import yargs from 'yargs';

import metadata from '../../src/metadata/command';

const cmd = yargs().command(metadata as any);

const parse = (command: string) => cmd.parse(command) as any;

test('metadata: default keepUnsupported should be false', (t) => {
  const options = parse('metadata -a common');
  t.is(options.keepUnsupported, false);
});

test('metadata: keepUnsupported can be set to true', (t) => {
  const options = parse('metadata -a common --keep-unsupported');
  t.is(options.keepUnsupported, true);
});

test('metadata: force option should work', (t) => {
  const options = parse('metadata -a common --force');
  t.is(options.force, true);
});

test('metadata: both force and keepUnsupported can be set', (t) => {
  const options = parse('metadata -a common --force --keep-unsupported');
  t.is(options.force, true);
  t.is(options.keepUnsupported, true);
});

test('metadata: adaptors option should be set', (t) => {
  const options = parse('metadata -a common');
  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('metadata: multiple adaptors should be handled', (t) => {
  const options = parse('metadata -a common -a http');
  t.deepEqual(options.adaptors, [
    '@openfn/language-common',
    '@openfn/language-http',
  ]);
});

test('metadata: adaptors expansion can be disabled', (t) => {
  const options = parse('metadata -a common --no-expand-adaptors');
  t.deepEqual(options.adaptors, ['common']);
});
