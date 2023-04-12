import test from 'ava';
import { jobPath, Opts } from '../../../src/options';

test('jobPath is set to path', (t) => {
  const opts = {
    path: 'jam.js',
  } as Opts;

  jobPath.ensure!(opts);

  t.is(opts.jobPath, 'jam.js');
});

test('jobPath uses job.js if path is a folder', (t) => {
  const opts = {
    path: '/jam',
  } as Opts;

  jobPath.ensure!(opts);

  t.is(opts.jobPath, '/jam/job.js');
});

test('jobPath uses job.js if path is a folder (trailing slash)', (t) => {
  const opts = {
    path: '/jam/',
  } as Opts;

  jobPath.ensure!(opts);

  t.is(opts.jobPath, '/jam/job.js');
});

test('jobPath sets the workflow', (t) => {
  const opts = {
    path: 'workflow.json',
  } as Opts;

  jobPath.ensure!(opts);

  t.is(opts.workflow, 'workflow.json');
});
