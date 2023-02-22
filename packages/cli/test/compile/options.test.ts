import test from 'ava';
import yargs from 'yargs';
import compile, { CompileOptions } from '../../src/compile/command';

const cmd = yargs().command(compile);

test('correct default options', (t) => {
  const options = cmd.parse('compile job.js') as CompileOptions;

  t.deepEqual(options.adaptors, []);
  t.is(options.command, 'compile');
  t.is(options.expandAdaptors, true);
  t.is(options.jobPath, 'job.js');
  t.falsy(options.logJson); // TODO this is undefined right now
  t.is(options.outputStdout, true);
  t.is(options.path, 'job.js');
  t.falsy(options.useAdaptorsMonorepo);
});

test('pass an adaptor (longform)', (t) => {
  const options = cmd.parse(
    'compile job.js --adaptor @openfn/language-common'
  ) as CompileOptions;
  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('pass an adaptor (shortform)', (t) => {
  const options = cmd.parse('compile job.js -a common') as CompileOptions;
  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('pass multiple adaptors (shortform)', (t) => {
  const options = cmd.parse(
    'compile job.js -a common -a http'
  ) as CompileOptions;
  t.deepEqual(options.adaptors, [
    '@openfn/language-common',
    '@openfn/language-http',
  ]);
});

test('disable expand adaptors', (t) => {
  const options = cmd.parse(
    'compile job.js --no-expand-adaptors'
  ) as CompileOptions;
  t.false(options.expandAdaptors);
});

test("don't expand adaptors if --no-expand-adaptors is set", (t) => {
  const options = cmd.parse(
    'compile job.js -a common --no-expand-adaptors'
  ) as CompileOptions;
  t.false(options.expandAdaptors);
  t.deepEqual(options.adaptors, ['common']);
});

test('default job path', (t) => {
  const options = cmd.parse(
    'compile /tmp/my-job/ --immutable'
  ) as CompileOptions;
  t.is(options.path, '/tmp/my-job/');
  t.is(options.jobPath, '/tmp/my-job/job.js');
});

test('enable json logging', (t) => {
  const options = cmd.parse('compile job.js --log-json') as CompileOptions;
  t.true(options.logJson);
});

test('set an output path (short)', (t) => {
  const options = cmd.parse(
    'compile job.js -o /tmp/out.json'
  ) as CompileOptions;
  t.is(options.outputPath, '/tmp/out.json');
});

test('set an output path (long)', (t) => {
  const options = cmd.parse(
    'compile job.js --output-path /tmp/out.json'
  ) as CompileOptions;
  t.is(options.outputPath, '/tmp/out.json');
});

test('output to stdout (short)', (t) => {
  const options = cmd.parse('compile job.js -O') as CompileOptions;
  t.true(options.outputStdout);
});

test('output to stdout (long)', (t) => {
  const options = cmd.parse('compile job.js --output-stdout') as CompileOptions;
  t.true(options.outputStdout);
});

test('output path overrides stdout', (t) => {
  const options = cmd.parse('compile job.js -O -o out.json') as CompileOptions;
  t.falsy(options.outputStdout);
  t.is(options.outputPath, 'out.json');
});
