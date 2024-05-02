import test from 'ava';
import yargs from 'yargs';
import apollo, { ApolloOptions } from '../../src/apollo/command';

const cmd = yargs().command(apollo as any);

const parse = (command: string) =>
  cmd.parse(command) as yargs.Arguments<ApolloOptions>;

test.todo('service name');

test('load the service name', (t) => {
  const options = parse('apollo test a/b/c.json');

  t.is(options.service, 'test');
});

test('load the payload path', (t) => {
  const options = parse('apollo test a/b/c.json');

  t.is(options.payload, 'a/b/c.json');
});

test('no default apollo url', (t) => {
  const options = parse('apollo test');

  t.falsy(options.apolloUrl);
});

test('explicitly set apollo url', (t) => {
  const options = parse('apollo test --apollo-url www');

  t.is(options.apolloUrl, 'www');
});

test('explicitly set apollo url with alias', (t) => {
  const options = parse('apollo test --url www');

  t.is(options.apolloUrl, 'www');
});

test('set apollo url with --staging', (t) => {
  const options = parse('apollo test --staging');

  t.is(options.apolloUrl, 'staging');
});

test('set apollo url with --prod', (t) => {
  const options = parse('apollo test --prod');

  t.is(options.apolloUrl, 'prod');
});

test('set apollo url with --production', (t) => {
  const options = parse('apollo test --production');

  t.is(options.apolloUrl, 'production');
});

test('set apollo url with --local', (t) => {
  const options = parse('apollo test --local');

  t.is(options.apolloUrl, 'local');
});

test('output to stdout by default', (t) => {
  const options = parse('apollo test a/b/c.json');

  t.true(options.outputStdout);
  t.falsy(options.outputPath);
});
