import test from 'ava';
import { outputPath, Opts } from '../../../src/options';

test('outputPath defaults to base/output.json', (t) => {
  const opts = {
    path: '/tmp/job.js',
  } as Opts;

  outputPath.ensure!(opts);

  t.is(opts.outputPath, '/tmp/output.json');
});

test('outputPath defaults to base/output.json for workflows', (t) => {
  const opts = {
    path: '/tmp/job.json',
  } as Opts;

  outputPath.ensure!(opts);

  t.is(opts.outputPath, '/tmp/output.json');
});

test('outputPath does not default if outputStdout is set', (t) => {
  const opts = {
    path: '/tmp/job.js',
    outputStdout: true,
  } as Opts;

  outputPath.ensure!(opts);

  t.falsy(opts.outputPath);
});

test('outputPath can be set to a value', (t) => {
  const opts = {
    outputPath: '/out.json',
  } as Opts;

  outputPath.ensure!(opts);

  t.is(opts.outputPath, '/out.json');
});

test('outputPath can be set to a value with compile', (t) => {
  const opts = {
    command: 'compile',
    outputPath: '/out.json',
  } as Opts;

  outputPath.ensure!(opts);

  t.is(opts.outputPath, '/out.json');
});

test('outputPath will be ignored if outputStdout is set', (t) => {
  const opts = {
    outputPath: '/out.json',
    outputStdout: true,
  } as Opts;

  outputPath.ensure!(opts);

  t.falsy(opts.outputPath);
});

test('outputPath removes outputStdout for compile', (t) => {
  const opts = {
    command: 'compile',
    outputPath: '/tmp/job-compiled.js',
    outputStdout: true,
  } as Opts;

  outputPath.ensure!(opts);

  t.is(opts.outputPath, '/tmp/job-compiled.js');
  t.falsy(opts.outputStdout);
});
