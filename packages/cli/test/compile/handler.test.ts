import test from 'ava';
import path from 'node:path';
import { deriveTestOutputPath, hasExportableCode } from '../../src/compile/handler';

const cwd = '/project';

// deriveTestOutputPath
test('path inside workflows dir → compiled/<rest>', (t) => {
  const result = deriveTestOutputPath(
    'workflows/dhis2-sync/transform.js',
    'compiled',
    'workflows',
    cwd
  );
  t.is(result, path.resolve(cwd, 'compiled/dhis2-sync/transform.js'));
});

test('path outside workflows dir → compiled/<basename>', (t) => {
  const result = deriveTestOutputPath(
    'scripts/helper.js',
    'compiled',
    'workflows',
    cwd
  );
  t.is(result, path.resolve(cwd, 'compiled/helper.js'));
});

test('respects custom compiledDir', (t) => {
  const result = deriveTestOutputPath(
    'workflows/step.js',
    'dist/compiled',
    'workflows',
    cwd
  );
  t.is(result, path.resolve(cwd, 'dist/compiled/step.js'));
});

test('respects custom workflowsDir', (t) => {
  const result = deriveTestOutputPath(
    'jobs/my-workflow/step.js',
    'compiled',
    'jobs',
    cwd
  );
  t.is(result, path.resolve(cwd, 'compiled/my-workflow/step.js'));
});

test('preserves nested subdirectory structure', (t) => {
  const result = deriveTestOutputPath(
    'workflows/wf-a/subdir/step.js',
    'compiled',
    'workflows',
    cwd
  );
  t.is(result, path.resolve(cwd, 'compiled/wf-a/subdir/step.js'));
});

// hasExportableCode
test('hasExportableCode: returns true for const declaration', (t) => {
  t.true(hasExportableCode("import x from 'y';\nconst helper = () => {};\nexport default [];"));
});

test('hasExportableCode: returns true for function declaration', (t) => {
  t.true(hasExportableCode("function formatDate(d) { return d; }\nexport default [];"));
});

test('hasExportableCode: returns true for exported const', (t) => {
  t.true(hasExportableCode("export const VALUE = 42;\nexport default [];"));
});

test('hasExportableCode: returns false when only imports', (t) => {
  t.false(hasExportableCode("import { get } from '@openfn/language-http';"));
});

test('hasExportableCode: returns false for empty string', (t) => {
  t.false(hasExportableCode(''));
});
