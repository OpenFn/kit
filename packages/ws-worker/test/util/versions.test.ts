import test from 'ava';
import pkg from '../../package.json' assert { type: 'json' };

import { calculateVersions } from '../../src/util/versions';
import { Context } from '../../src/api/execute';

// Create just enough context for tests to pass
const context = {
  engine: {
    version: '1.0.0',
  },
} as unknown as Context;

test('calculates node version', async (t) => {
  const versions = await calculateVersions(context);

  t.is(versions.node, process.version);
});

test('calculates worker version', async (t) => {
  const versions = await calculateVersions(context);
  t.is(versions.worker, pkg.version);
});

test('calculates engine version', async (t) => {
  const versions = await calculateVersions(context);
  t.is(versions.engine, context.engine.version);
});

// this test does everything at once
test.todo('calculates all versions');
