import test from 'ava';
import { inputPath, Opts } from '../../../src/options';

test('sets expressionPath using path', (t) => {
  const opts = {
    path: 'jam.js',
  } as Opts;

  inputPath.ensure!(opts);

  t.is(opts.expressionPath, 'jam.js');
});

test('sets expressionPath to path/job.js if path is a folder', (t) => {
  const opts = {
    path: '/jam',
  } as Opts;

  inputPath.ensure!(opts);

  t.is(opts.expressionPath, '/jam/job.js');
});

test('sets expressionPath to path/job.js if path is a folder (trailing slash)', (t) => {
  const opts = {
    path: '/jam/',
  } as Opts;

  inputPath.ensure!(opts);

  t.is(opts.expressionPath, '/jam/job.js');
});

test.skip('set workflowPath if path ends in json', (t) => {
  const opts = {
    path: 'workflow.json',
  } as Opts;

  inputPath.ensure!(opts);

  t.is(opts.workflowPath, 'workflow.json');
});
