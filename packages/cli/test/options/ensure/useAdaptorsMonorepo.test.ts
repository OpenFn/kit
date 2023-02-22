import test from 'ava';
import { useAdaptorsMonorepo, Opts } from '../../../src/options';

test('monorepoPath is unset by default', (t) => {
  const opts = {} as Opts;

  useAdaptorsMonorepo.ensure!(opts);

  t.falsy(opts.useAdaptorsMonorepo);
  t.falsy(opts.monorepoPath);
});

test('monorepoPath is unset even if env var exists', (t) => {
  process.env.OPENFN_ADAPTORS_REPO = 'a/b/c';
  const opts = {} as Opts;

  useAdaptorsMonorepo.ensure!(opts);

  t.falsy(opts.useAdaptorsMonorepo);
  t.falsy(opts.monorepoPath);
});

test('monorepoPath is unset if useAdaptorsMonorepo is false', (t) => {
  process.env.OPENFN_ADAPTORS_REPO = 'a/b/c';
  const opts = {
    useAdaptorsMonorepo: false,
  } as Opts;

  useAdaptorsMonorepo.ensure!(opts);

  t.falsy(opts.useAdaptorsMonorepo);
  t.falsy(opts.monorepoPath);
  delete process.env.OPENFN_ADAPTORS_REPO;
});

test('monorepoPath is set with a value from OPENFN_ADAPTORS_REPO', (t) => {
  process.env.OPENFN_ADAPTORS_REPO = 'a/b/c';
  const opts = {
    useAdaptorsMonorepo: true,
  } as Opts;

  useAdaptorsMonorepo.ensure!(opts);

  t.is(opts.monorepoPath, 'a/b/c');
  delete process.env.OPENFN_ADAPTORS_REPO;
});

// TODO this isn't actually good, just adding a test to track the behaviour
test('monorepoPath is set to an error value if OPENFN_ADAPTORS_REPO is not set', (t) => {
  delete process.env.OPENFN_ADAPTORS_REPO;
  const opts = {
    useAdaptorsMonorepo: true,
  } as Opts;

  useAdaptorsMonorepo.ensure!(opts);

  t.is(opts.monorepoPath, 'ERR');
});
