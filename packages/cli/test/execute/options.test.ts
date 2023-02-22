import test from 'ava';
import yargs from 'yargs';
import execute, { ExecuteOptions } from '../../src/execute/command';

const cmd = yargs().command(execute as any);

const parse = (command: string) =>
  cmd.parse(command) as yargs.Arguments<ExecuteOptions>;

test('correct default options', (t) => {
  const options = parse('execute job.js');

  t.deepEqual(options.adaptors, []);
  t.is(options.autoinstall, false);
  t.is(options.command, 'execute');
  t.is(options.compile, true);
  t.is(options.expandAdaptors, true);
  t.is(options.immutable, false);
  t.is(options.jobPath, 'job.js');
  t.falsy(options.logJson); // TODO this is undefined right now
  t.assert(options.outputPath?.endsWith('output.json')); // TODO jobPath is relative, but outputPath is absolute. tricky.
  t.is(options.outputStdout, false);
  t.is(options.path, 'job.js');
  t.is(options.skipAdaptorValidation, false);
  t.is(options.strictOutput, true);
  t.is(options.timeout, 300000);
  t.falsy(options.useAdaptorsMonorepo);
});

test('pass an adaptor (longform)', (t) => {
  const options = parse('execute job.js --adaptor @openfn/language-common');
  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('pass an adaptor (shortform)', (t) => {
  const options = parse('execute job.js -a common');
  t.deepEqual(options.adaptors, ['@openfn/language-common']);
});

test('pass multiple adaptors (shortform)', (t) => {
  const options = parse('execute job.js -a common -a http');
  t.deepEqual(options.adaptors, [
    '@openfn/language-common',
    '@openfn/language-http',
  ]);
});

test('enable autoinstall', (t) => {
  const options = parse('execute job.js -i');
  t.true(options.autoinstall);
});

test('enable autoinstall (longhand)', (t) => {
  const options = parse('execute job.js --autoinstall');
  t.true(options.autoinstall);
});

test('disable compile', (t) => {
  const options = parse('execute job.js --no-compile');
  t.false(options.compile);
});

test('disable expand adaptors', (t) => {
  const options = parse('execute job.js --no-expand-adaptors');
  t.false(options.expandAdaptors);
});

test("don't expand adaptors if --no-expand-adaptors is set", (t) => {
  const options = parse('execute job.js -a common --no-expand-adaptors');
  t.false(options.expandAdaptors);
  t.deepEqual(options.adaptors, ['common']);
});

test('enable immutability', (t) => {
  const options = parse('execute job.js --immutable');
  t.true(options.immutable);
});

test('default job path', (t) => {
  const options = parse('execute /tmp/my-job/ --immutable');
  t.is(options.path, '/tmp/my-job/');
  t.is(options.jobPath, '/tmp/my-job/job.js');
});

test('enable json logging', (t) => {
  const options = parse('execute job.js --log-json');
  t.true(options.logJson);
});

test('disable strict output', (t) => {
  const options = parse('execute job.js --no-strict-output');
  t.false(options.strictOutput);
});

test('set an output path (short)', (t) => {
  const options = parse('execute job.js -o /tmp/out.json');
  t.is(options.outputPath, '/tmp/out.json');
});

test('set an output path (long)', (t) => {
  const options = parse('execute job.js --output-path /tmp/out.json');
  t.is(options.outputPath, '/tmp/out.json');
});

test('output to stdout (short)', (t) => {
  const options = parse('execute job.js -O');
  t.true(options.outputStdout);
});

test('output to stdout (long)', (t) => {
  const options = parse('execute job.js --output-stdout');
  t.true(options.outputStdout);
});

test('output to stdout overrides output path', (t) => {
  const options = parse('execute job.js -O -o out.json');
  t.true(options.outputStdout);
  t.falsy(options.outputPath);
});

test('disable adaptor validation', (t) => {
  const options = parse('execute job.js --skip-adaptor-validation');
  t.true(options.skipAdaptorValidation);
});

test('set state path (short)', (t) => {
  const options = parse('execute job.js -s s.json');
  t.is(options.statePath, 's.json');
});

test('set state path (long)', (t) => {
  const options = parse('execute job.js --state-path s.json');
  t.is(options.statePath, 's.json');
});

test('set state via stdin (short)', (t) => {
  const options = parse('execute job.js -S x');
  t.is(options.stateStdin, 'x');
});

test('set timeout (short)', (t) => {
  const options = parse('execute job.js -t 1234');
  t.is(options.timeout, 1234);
});

test('set timeout (long)', (t) => {
  const options = parse('execute job.js --timeout 1234');
  t.is(options.timeout, 1234);
});
