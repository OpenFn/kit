import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isAdaptorUnsupported,
  markAdaptorAsUnsupported,
  type UnsupportedAdaptorCache,
} from '../../src/metadata/cache';
import { removePackage } from '../../src/repo/handler';

const logger = createMockLogger(undefined, { level: 'debug' });
const testRepoDir = '/tmp/test-purge-repo';

test.beforeEach(async () => {
  logger._reset();
  // Ensure clean test directory
  try {
    await rm(testRepoDir, { recursive: true, force: true });
  } catch (e) {
    // Directory might not exist, that's fine
  }
  await mkdir(testRepoDir, { recursive: true });
});

test.afterEach(async () => {
  logger._reset();
  // Cleanup
  try {
    await rm(testRepoDir, { recursive: true, force: true });
  } catch (e) {
    // Directory might not exist, that's fine
  }
});

test.serial(
  'isAdaptorUnsupported returns false for non-cached adaptors',
  async (t) => {
    const result = await isAdaptorUnsupported(
      '@openfn/language-common@1.0.0',
      testRepoDir
    );
    t.false(result);
  }
);

test.serial('markAdaptorAsUnsupported creates cache entry', async (t) => {
  await markAdaptorAsUnsupported('@openfn/language-common@1.0.0', testRepoDir);

  const cachePath = path.join(
    testRepoDir,
    '.cli-cache',
    'unsupported-metadata.json'
  );
  const content = await readFile(cachePath, 'utf8');
  const cache: UnsupportedAdaptorCache = JSON.parse(content);

  t.truthy(cache['@openfn/language-common']);
  t.is(cache['@openfn/language-common'].lastCheckedVersion, '1.0.0');
  t.is(cache['@openfn/language-common'].majorMinor, '1.0');
});

test.serial(
  'isAdaptorUnsupported returns true for cached same/lower versions',
  async (t) => {
    // Mark 1.5.0 as unsupported
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );

    // Check 1.5.0 - should be unsupported
    t.true(
      await isAdaptorUnsupported('@openfn/language-common@1.5.0', testRepoDir)
    );

    // Check 1.5.1 (patch increase) - should be unsupported
    t.true(
      await isAdaptorUnsupported('@openfn/language-common@1.5.1', testRepoDir)
    );

    // Check 1.4.9 (lower version) - should be unsupported
    t.true(
      await isAdaptorUnsupported('@openfn/language-common@1.4.9', testRepoDir)
    );
  }
);

test.serial(
  'isAdaptorUnsupported returns false for higher major.minor versions',
  async (t) => {
    // Mark 1.5.0 as unsupported
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );

    // Check 1.6.0 (minor increase) - should NOT be unsupported
    t.false(
      await isAdaptorUnsupported('@openfn/language-common@1.6.0', testRepoDir)
    );

    // Check 2.0.0 (major increase) - should NOT be unsupported
    t.false(
      await isAdaptorUnsupported('@openfn/language-common@2.0.0', testRepoDir)
    );
  }
);

test.serial(
  'markAdaptorAsUnsupported only updates with higher versions',
  async (t) => {
    // Mark 1.5.0 as unsupported
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );

    // Try to mark 1.4.0 as unsupported (should not update)
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.4.0',
      testRepoDir
    );

    const cachePath = path.join(
      testRepoDir,
      '.cli-cache',
      'unsupported-metadata.json'
    );
    const content = await readFile(cachePath, 'utf8');
    const cache: UnsupportedAdaptorCache = JSON.parse(content);

    // Should still be 1.5.0, not 1.4.0
    t.is(cache['@openfn/language-common'].lastCheckedVersion, '1.5.0');

    // Mark 1.6.0 as unsupported (should update)
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.6.0',
      testRepoDir
    );

    const updatedContent = await readFile(cachePath, 'utf8');
    const updatedCache: UnsupportedAdaptorCache = JSON.parse(updatedContent);

    // Should now be 1.6.0
    t.is(updatedCache['@openfn/language-common'].lastCheckedVersion, '1.6.0');
    t.is(updatedCache['@openfn/language-common'].majorMinor, '1.6');
  }
);

test.serial('should mark adaptor as unsupported in cache', async (t) => {
  const adaptor = '@openfn/language-test@1.5.2';

  await markAdaptorAsUnsupported(adaptor, testRepoDir);

  const isUnsupported = await isAdaptorUnsupported(adaptor, testRepoDir);
  t.true(isUnsupported);
});

test.serial('should retry on minor version bump', async (t) => {
  const oldAdaptor = '@openfn/language-test@1.5.2';
  const newAdaptor = '@openfn/language-test@1.6.0';

  // Mark 1.5.2 as unsupported
  await markAdaptorAsUnsupported(oldAdaptor, testRepoDir);

  // 1.5.2 should be unsupported
  t.true(await isAdaptorUnsupported(oldAdaptor, testRepoDir));

  // 1.6.0 should NOT be unsupported (should retry)
  t.false(await isAdaptorUnsupported(newAdaptor, testRepoDir));
});

test.serial('should not retry on patch version change', async (t) => {
  const oldAdaptor = '@openfn/language-test@1.5.2';
  const patchAdaptor = '@openfn/language-test@1.5.3';

  // Mark 1.5.2 as unsupported
  await markAdaptorAsUnsupported(oldAdaptor, testRepoDir);

  // 1.5.3 should also be unsupported (same major.minor)
  t.true(await isAdaptorUnsupported(patchAdaptor, testRepoDir));
});

test.serial('should not retry on lower version', async (t) => {
  const higherAdaptor = '@openfn/language-test@1.5.2';
  const lowerAdaptor = '@openfn/language-test@1.5.1';

  // Mark 1.5.2 as unsupported
  await markAdaptorAsUnsupported(higherAdaptor, testRepoDir);

  // 1.5.1 should also be unsupported (lower patch)
  t.true(await isAdaptorUnsupported(lowerAdaptor, testRepoDir));
});

test.serial('should handle major version bump correctly', async (t) => {
  const v1Adaptor = '@openfn/language-test@1.5.2';
  const v2Adaptor = '@openfn/language-test@2.0.0';

  // Mark 1.5.2 as unsupported
  await markAdaptorAsUnsupported(v1Adaptor, testRepoDir);

  // 2.0.0 should NOT be unsupported (should retry)
  t.false(await isAdaptorUnsupported(v2Adaptor, testRepoDir));
});

test.serial('should only cache highest version checked', async (t) => {
  const lowerAdaptor = '@openfn/language-test@1.5.1';
  const higherAdaptor = '@openfn/language-test@1.5.2';

  // Mark lower version as unsupported first
  await markAdaptorAsUnsupported(lowerAdaptor, testRepoDir);

  // Then mark higher version as unsupported
  await markAdaptorAsUnsupported(higherAdaptor, testRepoDir);

  // Check cache file directly
  const cachePath = path.join(
    testRepoDir,
    '.cli-cache',
    'unsupported-metadata.json'
  );
  const cacheContent = await readFile(cachePath, 'utf8');
  const cache = JSON.parse(cacheContent);

  // Should have cached the higher version
  t.is(cache['@openfn/language-test'].lastCheckedVersion, '1.5.2');
});

test.serial(
  'removePackage should handle non-existent package gracefully',
  async (t) => {
    // Create a minimal package.json
    const packageJson = {
      name: 'test-repo',
      dependencies: {},
    };
    await writeFile(
      path.join(testRepoDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Should not throw when trying to remove non-existent package
    await t.notThrowsAsync(async () => {
      await removePackage(
        '@openfn/language-nonexistent@1.0.0',
        testRepoDir,
        logger
      );
    });
  }
);
