import test from 'ava';
import path from 'node:path';
import { getLatestInstalledVersion } from '../../src/modules/repo';

test('return null if no version', async (t) => {
  const pkg = {
    dependencies: {},
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === null);
});

test('return the matching version', async (t) => {
  const pkg = {
    dependencies: {
      'openfn-fake_4.0.0': '',
      'openfn_3.0.0': '',
      'not_openfn_3.0.0': '',
    },
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === 'openfn_3.0.0');
});

test('return the higher version of 2', async (t) => {
  const pkg = {
    dependencies: {
      'openfn_2.0.0': '',
      'openfn_3.0.0': '',
    },
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === 'openfn_3.0.0');
});

test('return the higher if order is changed', async (t) => {
  const pkg = {
    dependencies: {
      'openfn_3.0.0': '',
      'openfn_2.0.0': '',
    },
  };
  const result = await getLatestInstalledVersion('openfn', '', pkg);
  t.assert(result === 'openfn_3.0.0');
});

test('should read package json from disk', async (t) => {
  const result = await getLatestInstalledVersion(
    'ultimate-answer',
    path.resolve('test/__repo')
  );
  t.assert(result === 'ultimate-answer_2.0.0');
});
