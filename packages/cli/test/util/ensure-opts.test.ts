import test from 'ava';
import { Opts } from '../../src/commands';
import ensureOpts, {
  defaultLoggerOptions,
  ERROR_MESSAGE_LOG_LEVEL,
  ERROR_MESSAGE_LOG_COMPONENT,
} from '../../src/util/ensure-opts';

delete process.env.OPENFN_ADAPTORS_REPO;

test('preserve the command name', (t) => {
  const initialOpts = {
    command: 'compile',
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.command === 'compile');
});

test('set job and state from a base path', (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.jobPath === 'a/job.js');
  t.assert(opts.outputPath === 'a/output.json');
});

test("default base path to '.'", (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts(undefined, initialOpts);

  t.assert(opts.jobPath === './job.js');
  t.assert(opts.outputPath === './output.json');
});

test('should output from a base path with an extension', (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts('a/x.js', initialOpts);
  t.assert(opts.jobPath === 'a/x.js');
  t.assert(opts.outputPath === 'a/output.json');
});

test('should not set outputPath if stdout is requested', (t) => {
  const initialOpts = {
    outputStdout: true,
  } as Opts;

  const opts = ensureOpts('a/x.js', initialOpts);
  t.assert(opts.jobPath === 'a/x.js');
  t.falsy(opts.outputPath);
});

test("should use the user's state path", (t) => {
  const statePath = '/tmp/my-state.json';
  const initialOpts = {
    statePath,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);
  t.assert(opts.jobPath === 'a/job.js');
  t.assert(opts.statePath === statePath);
  t.assert(opts.outputPath === 'a/output.json');
});

test("should use the user's output path", (t) => {
  const outputPath = '/tmp/my-state.json';
  const initialOpts = {
    outputPath,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);
  t.assert(opts.jobPath === 'a/job.js');
  t.assert(opts.outputPath === outputPath);
});

test('preserve outputStdout', (t) => {
  const initialOpts = {
    outputStdout: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.outputStdout);
});

test('preserve strictOutput false', (t) => {
  const initialOpts = {
    strictOutput: false,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.false(opts.strictOutput);
});

test('preserve strictOutput true', (t) => {
  const initialOpts = {
    strictOutput: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.true(opts.strictOutput);
});

test('strictOutput true by default', (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.true(opts.strictOutput);
});

test('preserve force', (t) => {
  const initialOpts = {
    force: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.force);
});

test('preserve timeout', (t) => {
  const initialOpts = {
    timeout: 999,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.is(opts.timeout, 999);
});

test('preserve noCompile', (t) => {
  const initialOpts = {
    noCompile: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.noCompile);
});

test('preserve expand', (t) => {
  const initialOpts = {
    expand: false,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.false(opts.expand);
});

test('preserve logJson', (t) => {
  const initialOpts = {
    logJson: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.true(opts.logJson);
});

test('default logJson to true if env var is set', (t) => {
  process.env.OPENFN_LOG_JSON = 'true';

  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.true(opts.logJson);
  delete process.env.OPENFN_LOG_JSON;
});

test('logJson argument overrides env var', (t) => {
  process.env.OPENFN_LOG_JSON = 'true';

  const initialOpts = {
    logJson: false,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.false(opts.logJson);
  delete process.env.OPENFN_LOG_JSON;
});

test('preserve specifier', (t) => {
  const initialOpts = {
    specifier: '@openfn/language-common@1.0.0',
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.is(opts.specifier, '@openfn/language-common@1.0.0');
});

test('default expand', (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.true(opts.expand);
});

test('default expand if undefined', (t) => {
  // @ts-ignore
  const initialOpts = {
    expand: undefined,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.true(opts.expand);
});

test('default expand if null', (t) => {
  // @ts-ignore
  const initialOpts = {
    expand: null,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.true(opts.expand);
});

test('preserve stateStdin', (t) => {
  const initialOpts = {
    stateStdin: '{}',
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.stateStdin === '{}');
});

test('preserve immutable', (t) => {
  const initialOpts = {
    immutable: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.immutable);
});

test('default immutable to false', (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.immutable === false);
});

test('perserve the autoinstall flag', (t) => {
  const initialOpts = {
    autoinstall: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.autoinstall);
});

// TODO does this make sense?
// This is the question of: should we have an ensure-opt for each command
test('update the default output with compile only', (t) => {
  const initialOpts = {
    command: 'compile',
    compileOnly: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.outputPath === 'a/output.js');
});

test('monorepoPath: unset by default', (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);
  t.falsy(opts.useAdaptorsMonorepo);
});

test('monorepoPath: unset even if env var is set default', (t) => {
  process.env.OPENFN_ADAPTORS_REPO = 'a/b/c';
  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);
  t.falsy(opts.useAdaptorsMonorepo);
});

test('monorepoPath: unset if useAdaptorsMonorepo is false', (t) => {
  process.env.OPENFN_ADAPTORS_REPO = 'a/b/c';
  const initialOpts = {
    useAdaptorsMonorepo: false,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);
  t.falsy(opts.useAdaptorsMonorepo);
});

test('monorepoPath: load from OPENFN_ADAPTORS_REPO', (t) => {
  process.env.OPENFN_ADAPTORS_REPO = 'a/b/c';
  const initialOpts = {
    useAdaptorsMonorepo: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);
  t.is(opts.monorepoPath, 'a/b/c');
  delete process.env.OPENFN_ADAPTORS_REPO;
});

test('perserve the skipAdaptorValidation flag', (t) => {
  const initialOpts = {
    skipAdaptorValidation: true,
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.skipAdaptorValidation);
});

test('log: add default options', (t) => {
  const initialOpts = {} as Opts;

  const opts = ensureOpts('', initialOpts);

  t.deepEqual(opts.log, defaultLoggerOptions);
});

test('log: override default options', (t) => {
  const initialOpts = {
    log: ['debug'],
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.default, 'debug');
});

test('log: set a specific option', (t) => {
  const initialOpts = {
    log: ['compiler=debug'],
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.compiler, 'debug');
});

test('log: throw if an unknown log level is passed', (t) => {
  const initialOpts = {
    log: ['foo'],
  } as Opts;

  const error = t.throws(() => ensureOpts('', initialOpts));
  t.is(error?.message, ERROR_MESSAGE_LOG_LEVEL);
});

test('log: throw if an unknown log level is passed to a component', (t) => {
  const initialOpts = {
    log: ['cli=foo'],
  } as Opts;

  const error = t.throws(() => ensureOpts('', initialOpts));
  t.is(error?.message, ERROR_MESSAGE_LOG_LEVEL);
});

test('log: throw if an unknown log component is passed', (t) => {
  const initialOpts = {
    log: ['foo=debug'],
  } as Opts;

  const error = t.throws(() => ensureOpts('', initialOpts));
  t.is(error?.message, ERROR_MESSAGE_LOG_COMPONENT);
});

test('log: accept short component names', (t) => {
  const initialOpts = {
    log: ['cmp=debug', 'r/t=debug'],
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.compiler, 'debug');
  t.is(opts.log.runtime, 'debug');
});

test('log: arguments are case insensitive', (t) => {
  const initialOpts = {
    log: ['ClI=InFo'],
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.cli, 'info');
});

test('log: set default and a specific option', (t) => {
  const initialOpts = {
    log: ['none', 'compiler=debug'],
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.default, 'none');
  t.is(opts.log.compiler, 'debug');
});

test('log: default to info for test', (t) => {
  const initialOpts = {
    command: 'test',
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.default, 'info');
});

test('log: default to info for version', (t) => {
  const initialOpts = {
    command: 'version',
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.default, 'info');
});

test('log: always info for version', (t) => {
  const initialOpts = {
    command: 'version',
    log: ['debug'],
  } as Opts;

  const opts = ensureOpts('', initialOpts);

  t.is(opts.log.default, 'info');
});

test.serial('preserve repoDir', (t) => {
  const initialOpts = {
    repoDir: 'a/b/c',
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.repoDir === 'a/b/c');
});

test.serial('use an env var for repoDir', (t) => {
  process.env.OPENFN_REPO_DIR = 'JAM';

  const initialOpts = {} as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.truthy(opts.repoDir === 'JAM');
  delete process.env.OPENFN_REPO_DIR;
});

test.serial('use prefer an explicit value for repoDirto an env var', (t) => {
  process.env.OPENFN_REPO_DIR = 'JAM';

  const initialOpts = {
    repoDir: 'a/b/c',
  } as Opts;

  const opts = ensureOpts('a', initialOpts);

  t.assert(opts.repoDir === 'a/b/c');
});
// TODO what if stdout and output path are set?
