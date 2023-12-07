import test from 'ava';
import loadVersions from '../../src/util/load-versions';
import pkg from '../../package.json' assert { type: 'json' };

// This test is a bti silly because it basically duplicates the actual implementation
// but what else can we do?
test('loads node, engine and compiler versions', (t) => {
  const result = loadVersions();

  t.deepEqual(result, {
    node: process.version.substring(1),
    engine: pkg.version,
    compiler: pkg.dependencies['@openfn/compiler'],
    runtime: pkg.dependencies['@openfn/runtime'],
  });
});

test('returns a cloned object', (t) => {
  const a = loadVersions();
  const b = loadVersions();

  t.deepEqual(a, b);

  a['@openfn/language-common'] = '1.0.0';

  t.notDeepEqual(a, b);
});
