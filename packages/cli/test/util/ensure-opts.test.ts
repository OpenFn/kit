import test from 'ava';
import ensureLogOpts, {
  defaultLoggerOptions,
  ERROR_MESSAGE_LOG_LEVEL,
  ERROR_MESSAGE_LOG_COMPONENT,
} from '../../src/util/ensure-log-opts';

delete process.env.OPENFN_ADAPTORS_REPO;

test('log: add default options', (t) => {
  const initialOpts = {};

  const opts = ensureLogOpts(initialOpts);

  t.deepEqual(opts.log, defaultLoggerOptions);
});

test('log: override default options', (t) => {
  const initialOpts = {
    log: 'debug',
  };

  const opts = ensureLogOpts(initialOpts);

  t.is(opts.log!.default, 'debug');
});

test('log: set a specific option', (t) => {
  const initialOpts = {
    log: 'compiler=debug',
  };

  const opts = ensureLogOpts(initialOpts);

  t.is(opts.log!.compiler, 'debug');
});

test('log: throw if an unknown log level is passed', (t) => {
  const initialOpts = {
    log: 'foo',
  };

  const error = t.throws(() => ensureLogOpts(initialOpts));
  t.is(error?.message, ERROR_MESSAGE_LOG_LEVEL);
});

test('log: throw if an unknown log level is passed to a component', (t) => {
  const initialOpts = {
    log: 'cli=foo',
  };

  const error = t.throws(() => ensureLogOpts(initialOpts));
  t.is(error?.message, ERROR_MESSAGE_LOG_LEVEL);
});

test('log: throw if an unknown log component is passed', (t) => {
  const initialOpts = {
    log: 'foo=debug',
  };

  const error = t.throws(() => ensureLogOpts(initialOpts));
  t.is(error?.message, ERROR_MESSAGE_LOG_COMPONENT);
});

test('log: accept short component names', (t) => {
  const initialOpts = {
    log: 'cmp=debug,r/t=debug',
  };

  const opts = ensureLogOpts(initialOpts);

  t.is(opts.log!.compiler, 'debug');
  t.is(opts.log!.runtime, 'debug');
});

test('log: arguments are case insensitive', (t) => {
  const initialOpts = {
    log: 'ClI=InFo',
  };

  const opts = ensureLogOpts(initialOpts);

  t.is(opts.log!.cli, 'info');
});

test('log: set default and a specific option', (t) => {
  const initialOpts = {
    log: 'none,compiler=debug',
  };

  const opts = ensureLogOpts(initialOpts);

  t.is(opts.log!.default, 'none');
  t.is(opts.log!.compiler, 'debug');
});

test('log: default to info for test', (t) => {
  const initialOpts = {
    command: 'test',
  };

  const opts = ensureLogOpts(initialOpts);

  t.is(opts.log!.default, 'info');
});

test('log: default to info for version', (t) => {
  const initialOpts = {
    command: 'version',
  };

  const opts = ensureLogOpts(initialOpts);

  t.is(opts.log!.default, 'info');
});
