import test from 'ava';
import { Opts } from '../src/execute';
import ensureOpts from '../src/ensure-opts';

test('set job, state and output from a base path', (t) => {
  const initialOpts = {} as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.jobPath === 'a/job.js');
  t.assert(opts.statePath === 'a/state.json');
  t.assert(opts.outputPath === 'a/output.json');
});

test('should set state and output from a base path with an extension', (t) => {
  const initialOpts = {} as Opts;
  
  const opts = ensureOpts('a/x.js', initialOpts);
  t.assert(opts.jobPath === 'a/x.js');
  t.assert(opts.statePath === 'a/state.json');
  t.assert(opts.outputPath === 'a/output.json');
});

test('should not set outputPath if stdout is requested', (t) => {
  const initialOpts = {
    outputStdout: true
  } as Opts;
  
  const opts = ensureOpts('a/x.js', initialOpts);
  t.assert(opts.jobPath === 'a/x.js');
  t.assert(opts.statePath === 'a/state.json');
  t.falsy(opts.outputPath);
});

test('should use the user\'s state path', (t) => {
  const statePath = '/tmp/my-state.json';
  const initialOpts = {
    statePath,
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);
  t.assert(opts.jobPath === 'a/job.js');
  t.assert(opts.statePath === statePath);
  t.assert(opts.outputPath === 'a/output.json');
});

test('should use the user\'s output path', (t) => {
  const outputPath = '/tmp/my-state.json';
  const initialOpts = {
    outputPath,
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);
  t.assert(opts.jobPath === 'a/job.js');
  t.assert(opts.outputPath === outputPath);
  t.assert(opts.statePath === 'a/state.json');
});

test('should append @openfn to adaptors', (t) => {
  const initialOpts = {
    adaptors: ['language-common=a/b/c']
  } as Opts;
  const opts = ensureOpts('a', initialOpts);
  t.assert(opts.adaptors[0] === '@openfn/language-common=a/b/c');
});

test('should not append @openfn to adaptors if already prefixed', (t) => {
  const initialOpts = {
    adaptors: ['@openfn/language-common=a/b/c']
  } as Opts;
  const opts = ensureOpts('a', initialOpts);
  t.assert(opts.adaptors[0] === '@openfn/language-common=a/b/c');
})

// TODO what if stdout and output path are set?