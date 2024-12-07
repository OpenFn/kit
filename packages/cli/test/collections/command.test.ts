import test from 'ava';
import yargs from 'yargs';
import collections, {
  GetOptions,
  SetOptions,
  RemoveOptions,
} from '../../src/collections/command';

// test option parsing
const cmd = yargs().command(collections as any);

const parse = (command: string) =>
  cmd.parse(command) as yargs.Arguments<
    GetOptions | SetOptions | RemoveOptions
  >;

test('all commands log to info by default', (t) => {
  for (const cmd of ['get', 'set', 'remove']) {
    const options = parse(`collections ${cmd} my-collection some-key`);
    t.is(options.command, `collections-${cmd}`);
    t.is(options.log?.default, 'info');
  }
});

test('all commands accept a token', (t) => {
  for (const cmd of ['get', 'set', 'remove']) {
    const options = parse(
      `collections ${cmd} my-collection some-key --token abc`
    );
    t.is(options.command, `collections-${cmd}`);
    t.is(options.token, 'abc');
  }
});

test('all commands accept a lighting url', (t) => {
  for (const cmd of ['get', 'set', 'remove']) {
    const options = parse(
      `collections ${cmd} my-collection some-key --lightning app.openfn.org`
    );
    t.is(options.command, `collections-${cmd}`);
    t.is(options.lightning, 'app.openfn.org');
  }
});

test('get with name and key', (t) => {
  const options = parse('collections get my-collection some-key');
  t.is(options.command, 'collections-get');
  t.is(options.collectionName, 'my-collection');
  t.is(options.key, 'some-key');
});

test('get with name and key-pattern', (t) => {
  const options = parse('collections get my-collection *');
  t.is(options.command, 'collections-get');
  t.is(options.collectionName, 'my-collection');
  t.is(options.key, '*');
});

test('get with pageSize', (t) => {
  const options = parse(
    'collections get my-collection some-key --page-size 22'
  );
  t.is(options.pageSize, 22);
});

test('get with pretty output', (t) => {
  const options = parse('collections get my-collection some-key --pretty');
  t.is(options.pretty, true);
});

test('get with limit', (t) => {
  const options = parse('collections get my-collection some-key --limit 999');
  t.is(options.limit, 999);
});

test('get with output path', (t) => {
  const options = parse(
    'collections get my-collection some-key --o x/y/z.json'
  );
  t.is(options.outputPath, 'x/y/z.json');
});

test('remove with collection and key', (t) => {
  const options = parse('collections remove my-collection some-key');
  t.is(options.collectionName, 'my-collection');
  t.is(options.key, 'some-key');
});

test('remove with dry run', (t) => {
  const options = parse('collections remove my-collection some-key --dry-run');
  t.is(options.collectionName, 'my-collection');
  t.true(options.dryRun);
});

test('set with collection, key and value path', (t) => {
  const options = parse('collections set my-collection some-key x/y/z.json');
  t.is(options.collectionName, 'my-collection');
  t.is(options.key, 'some-key');
  t.is(options.value, 'x/y/z.json');
});

test('set with collection, key and items path', (t) => {
  const options = parse('collections set my-collection --items x/y/z.json');
  t.is(options.collectionName, 'my-collection');
  t.is(options.items, 'x/y/z.json');
});
