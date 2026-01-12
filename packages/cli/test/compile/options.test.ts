import test from 'ava';
import yargs from 'yargs';
import compile, { CompileOptions } from '../../src/compile/command';

const cmd = yargs().command(compile as any);

const parse = (command: string) =>
  cmd.parse(command) as yargs.Arguments<CompileOptions>;

test('correct default options', (t) => {
  const options = parse('compile job.js');

  t.deepEqual(options.adaptors, []);
  t.is(options.command, 'compile');
  t.is(options.expandAdaptors, true);
  t.is(options.expressionPath, 'job.js');
  t.falsy(options.logJson); // TODO this is undefined right now
  t.is(options.outputStdout, true);
  t.is(options.path, 'job.js');
  t.falsy(options.useAdaptorsMonorepo);
});

test('pass an adaptor (longform)', (t) => {
  const options = parse('compile job.js --adaptor @openfn/language-common');
  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('pass an adaptor (shortform)', (t) => {
  const options = parse('compile job.js -a common');
  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('pass multiple adaptors (shortform)', (t) => {
  const options = parse('compile job.js -a common -a http');
  t.deepEqual(options.adaptors, [
    '@openfn/language-common',
    '@openfn/language-http',
  ]);
});

test('disable expand adaptors', (t) => {
  const options = parse('compile job.js --no-expand-adaptors');
  t.false(options.expandAdaptors);
});

test("don't expand adaptors if --no-expand-adaptors is set", (t) => {
  const options = parse('compile job.js -a common --no-expand-adaptors');
  t.false(options.expandAdaptors);
  t.deepEqual(options.adaptors, ['common']);
});

test('enable json logging', (t) => {
  const options = parse('compile job.js --log-json');
  t.true(options.logJson);
});

test('set an output path (short)', (t) => {
  const options = parse('compile job.js -o /tmp/out.json');
  t.is(options.outputPath, '/tmp/out.json');
});

test('set an output path (long)', (t) => {
  const options = parse('compile job.js --output-path /tmp/out.json');
  t.is(options.outputPath, '/tmp/out.json');
});

test('output to stdout (short)', (t) => {
  const options = parse('compile job.js -O');
  t.true(options.outputStdout);
});

test('output to stdout (long)', (t) => {
  const options = parse('compile job.js --output-stdout');
  t.true(options.outputStdout);
});

test('output path overrides stdout', (t) => {
  const options = parse('compile job.js -O -o out.json');
  t.falsy(options.outputStdout);
  t.is(options.outputPath, 'out.json');
});

test('disable all imports', (t) => {
  const options = parse('compile job.js --ignore-imports');
  t.true(options.ignoreImports);
});

test('disable some imports', (t) => {
  const options = parse('compile job.js --ignore-imports=jam,jar');
  const [a, b] = options.ignoreImports as string[];
  t.is(a, 'jam');
  t.is(b, 'jar');
});
