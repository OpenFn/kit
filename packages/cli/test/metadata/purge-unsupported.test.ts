import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getUnsupportedCache,
  isAdaptorUnsupported,
  markAdaptorAsUnsupported,
  type UnsupportedAdaptorCache,
} from '../../src/metadata/cache';
import { removePackage } from '../../src/repo/handler';

const logger = createMockLogger(undefined, { level: 'debug' });
const testRepoDir = '/tmp/test-purge-repo';

test.beforeEach(async () => {
  await rm(testRepoDir, { recursive: true, force: true });
  await mkdir(testRepoDir, { recursive: true });
});

test.afterEach(async () => {
  logger._reset();
  await rm(testRepoDir, { recursive: true, force: true });
});

const getTestCache = async () =>
  (await getUnsupportedCache(testRepoDir)) as UnsupportedAdaptorCache;

test.serial('markAdaptorAsUnsupported creates cache entry', async (t) => {
  await markAdaptorAsUnsupported('@openfn/language-common@1.0.0', testRepoDir);

  const cache = await getTestCache();

  t.truthy(cache['@openfn/language-common']);
  t.is(cache['@openfn/language-common'].lastCheckedVersion, '1.0.0');
  t.is(cache['@openfn/language-common'].majorMinor, '1.0');
});

test.serial(
  'markAdaptorAsUnsupported only updates with higher versions',
  async (t) => {
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );

    let cache = await getTestCache();
    t.is(cache['@openfn/language-common'].lastCheckedVersion, '1.5.0');

    // Try to mark 1.4.0 as unsupported (should not update)
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.4.0',
      testRepoDir
    );

    cache = await getTestCache();

    // Should still be 1.5.0, not 1.4.0
    t.is(cache['@openfn/language-common'].lastCheckedVersion, '1.5.0');

    // Mark 1.6.0 as unsupported  - this should update
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.6.0',
      testRepoDir
    );

    cache = await getTestCache();

    t.is(cache['@openfn/language-common'].lastCheckedVersion, '1.6.0');
    t.is(cache['@openfn/language-common'].majorMinor, '1.6');
  }
);

test.serial('should mark adaptor as unsupported in cache', async (t) => {
  const adaptor = '@openfn/language-test@1.5.2';

  await markAdaptorAsUnsupported(adaptor, testRepoDir);

  const isUnsupported = await isAdaptorUnsupported(adaptor, testRepoDir);
  t.true(isUnsupported);
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

test.serial(
  'isAdaptorUnsupported returns true if the same adaptor version has been marked as unsupported',
  async (t) => {
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );

    t.true(
      await isAdaptorUnsupported('@openfn/language-common@1.5.0', testRepoDir)
    );
  }
);

test.serial(
  'isAdaptorUnsupported returns true if a higher version was marked unsupported',
  async (t) => {
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );
    t.true(
      await isAdaptorUnsupported('@openfn/language-common@1.4.9', testRepoDir)
    );
  }
);

test.serial(
  'isAdaptorUnsupported returns true if a lower patch version was marked unsupported',
  async (t) => {
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );
    t.true(
      await isAdaptorUnsupported('@openfn/language-common@1.4.9', testRepoDir)
    );
  }
);

test.serial(
  'isAdaptorUnsupported returns false if a lower version major & minor was marked unsupported',
  async (t) => {
    await markAdaptorAsUnsupported(
      '@openfn/language-common@1.5.0',
      testRepoDir
    );

    t.false(
      await isAdaptorUnsupported('@openfn/language-common@1.6.0', testRepoDir)
    );

    t.false(
      await isAdaptorUnsupported('@openfn/language-common@2.0.0', testRepoDir)
    );
  }
);

test.serial('should only cache highest version checked', async (t) => {
  const lowerAdaptor = '@openfn/language-test@1.5.1';
  const higherAdaptor = '@openfn/language-test@1.5.2';

  // Mark lower version as unsupported first
  await markAdaptorAsUnsupported(lowerAdaptor, testRepoDir);

  // Then mark higher version as unsupported
  await markAdaptorAsUnsupported(higherAdaptor, testRepoDir);

  const cache = await getTestCache();

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
