import test from 'ava';
import { Opts } from '../../src/commands';
import ensureOpts, { defaultLoggerOptions } from '../../src/util/ensure-opts';

test('set job, state and output from a base path', (t) => {
  const initialOpts = {} as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.jobPath === 'a/job.js');
  t.assert(opts.statePath === 'a/state.json');
  t.assert(opts.outputPath === 'a/output.json');
});

test("default base path to '.'", (t) => {
  const initialOpts = {} as Opts;
  
  const opts = ensureOpts(undefined, initialOpts);

  t.assert(opts.jobPath === './job.js');
  t.assert(opts.statePath === './state.json');
  t.assert(opts.outputPath === './output.json');
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

test('should not append @openfn to adaptors if already prefixed', (t) => {
  const initialOpts = {
    adaptors: ['@openfn/language-common=a/b/c']
  } as Opts;
  const opts = ensureOpts('a', initialOpts);
  t.assert(opts.adaptors[0] === '@openfn/language-common=a/b/c');
})

test('preserve silent', (t) => {
  const initialOpts = {
    silent: true
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.silent);
});

test('preserve outputStdout', (t) => {
  const initialOpts = {
    outputStdout: true
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.outputStdout);
});

test('preserve noCompile', (t) => {
  const initialOpts = {
    noCompile: true
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.noCompile);
});

test('preserve stateStdin', (t) => {
  const initialOpts = {
    stateStdin: '{}'
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.stateStdin === '{}');
});


test('preserve trace', (t) => {
  const initialOpts = {
    traceLinker: true
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.traceLinker);
});

test('compile only', (t) => {
  const initialOpts = {
    compileOnly: true
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.compileOnly);
});

test('update the default output with compile only', (t) => {
  const initialOpts = {
    compileOnly: true
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.outputPath === 'a/output.js');
});

test('test mode logs to info', (t) => {
  const initialOpts = {
    test: true,
  } as Opts;
  
  const opts = ensureOpts('', initialOpts);

  t.truthy(opts.test);
  t.deepEqual(opts.log.global, { level: 'info' });
});

test('log: add default options', (t) => {
  const initialOpts = {} as Opts;
  
  const opts = ensureOpts('', initialOpts);

  t.deepEqual(opts.log, defaultLoggerOptions);
});

test('log: override global options', (t) => {
  const initialOpts = {
    log: ['debug'],
  } as Opts;
  
  const opts = ensureOpts('', initialOpts);

  t.deepEqual(opts.log.global, { level: 'debug' });
});

test('log: set a specific option', (t) => {
  const initialOpts = {
    log: ['compiler=debug'],
  } as Opts;
  
  const opts = ensureOpts('', initialOpts);

  t.deepEqual(opts.log.compiler, { level: 'debug' });
});

test('log: set global and a specific option', (t) => {
  const initialOpts = {
    log: ['none', 'compiler=debug'],
  } as Opts;
  
  const opts = ensureOpts('', initialOpts);

  t.deepEqual(opts.log.global, { level: 'none' });
  t.deepEqual(opts.log.compiler, { level: 'debug' });
});

test.serial('preserve modulesHome', (t) => {
  const initialOpts = {
    modulesHome: 'a/b/c'
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.modulesHome === 'a/b/c');
});

test.serial('use an env var for modulesHome', (t) => {
  process.env.OPENFN_MODULES_HOME = 'JAM';

  const initialOpts = {} as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.modulesHome === 'JAM');
  delete process.env.OPENFN_MODULES_HOME
});

test.serial('use prefer an explicit value for modulesHometo an env var', (t) => {
  process.env.OPENFN_MODULES_HOME = 'JAM';

  const initialOpts = {
    modulesHome: 'a/b/c'
  } as Opts;
  
  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.modulesHome === 'a/b/c');
});
// TODO what if stdout and output path are set?