import path from 'node:path';
import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';

import mapAdaptorsToMonorepo, {
  validateMonoRepo,
  updatePath,
} from '../../src/util/map-adaptors-to-monorepo';
import { ExecutionPlan } from '@openfn/runtime';

// Paths are resolved to absolute in the option's ensure block, so the util
// always receives absolute roots
const REPO_PATH = path.resolve('a/b/c');
const REPO_PATH_2 = path.resolve('d/e/f');

const logger = createMockLogger();

test.afterEach(() => {
  logger._reset();
  mock.restore();
});

test.serial('updatePath: common', (t) => {
  mock({
    [`${REPO_PATH}/packages/common`]: {},
  });

  const result = updatePath('common', [REPO_PATH], logger);

  t.is(result, `common=${REPO_PATH}/packages/common`);
});

test.serial('updatePath: @openfn/language-common', (t) => {
  mock({
    [`${REPO_PATH}/packages/common`]: {},
  });

  const result = updatePath('@openfn/language-common', [REPO_PATH], logger);

  t.is(result, `@openfn/language-common=${REPO_PATH}/packages/common`);
});

test.serial('updatePath: common@1.2.3 (with warning)', (t) => {
  mock({
    [`${REPO_PATH}/packages/common`]: {},
  });

  const result = updatePath('common@1.2.3', [REPO_PATH], logger);

  t.is(result, `common=${REPO_PATH}/packages/common`);

  const { level, message } = logger._parse(logger._last);
  t.is(level, 'warn');
  t.regex(message as string, /ignoring version specifier/i);
});

test('updatePath: common=x/y/z', (t) => {
  const result = updatePath('common=x/y/z', [REPO_PATH], logger);

  t.is(result, `common=x/y/z`);
});

test.serial('updatePath: prefer the root which has the adaptor', (t) => {
  mock({
    [`${REPO_PATH_2}/packages/common`]: {},
  });

  // common only exists in the second root, so that path should be used
  const result = updatePath('common', [REPO_PATH, REPO_PATH_2], logger);

  t.is(result, `common=${REPO_PATH_2}/packages/common`);
});

test.serial('updatePath: earlier root wins when both have the adaptor', (t) => {
  mock({
    [`${REPO_PATH}/packages/common`]: {},
    [`${REPO_PATH_2}/packages/common`]: {},
  });

  const result = updatePath('common', [REPO_PATH, REPO_PATH_2], logger);

  t.is(result, `common=${REPO_PATH}/packages/common`);
});

test.serial('updatePath: throw if not found in the single root', (t) => {
  mock({
    [`${REPO_PATH}/packages`]: {},
  });

  t.throws(() => updatePath('common', [REPO_PATH], logger), {
    message: /not found in the adaptors monorepo/,
  });
});

test.serial('updatePath: throw if not found in any root', (t) => {
  mock({
    [`${REPO_PATH}/packages`]: {},
    [`${REPO_PATH_2}/packages`]: {},
  });

  t.throws(() => updatePath('common', [REPO_PATH, REPO_PATH_2], logger), {
    message: /not found in any provided adaptors monorepo/,
  });
});

// TODO can't test this in ava, have to use an integration test
test.skip('validate monorepo: log and exit early if repo not found', async (t) => {
  mock({
    a: {},
  });

  await t.throwsAsync(async () => validateMonoRepo([REPO_PATH], logger), {
    message: 'Monorepo not found',
  });
  const { level, message } = logger._parse(logger._last);
  t.is(level, 'error');
  t.is(message, `ERROR: Monorepo not found at ${REPO_PATH}`);
});

test.serial('validate monorepo: all OK', async (t) => {
  mock({
    [`${REPO_PATH}/packages`]: {},
  });

  await t.notThrowsAsync(async () => validateMonoRepo([REPO_PATH], logger));
});

test.serial('validate monorepo: all OK with multiple paths', async (t) => {
  mock({
    [`${REPO_PATH}/packages`]: {},
    [`${REPO_PATH_2}/packages`]: {},
  });

  await t.notThrowsAsync(async () =>
    validateMonoRepo([REPO_PATH, REPO_PATH_2], logger)
  );
});

test.serial('mapAdaptorsToMonorepo: map adaptors', async (t) => {
  mock({
    [`${REPO_PATH}/packages/common`]: {},
  });

  const result = await mapAdaptorsToMonorepo([REPO_PATH], ['common'], logger);
  t.deepEqual(result, [`common=${REPO_PATH}/packages/common`]);
});

test.serial(
  'mapAdaptorsToMonorepo: map adaptors across multiple roots',
  async (t) => {
    mock({
      [`${REPO_PATH}/packages/http`]: {},
      [`${REPO_PATH_2}/packages/common`]: {},
    });

    const result = await mapAdaptorsToMonorepo(
      [REPO_PATH, REPO_PATH_2],
      ['http', 'common'],
      logger
    );
    t.deepEqual(result, [
      `http=${REPO_PATH}/packages/http`,
      `common=${REPO_PATH_2}/packages/common`,
    ]);
  }
);

test.serial('mapAdaptorsToMonorepo: map workflow', async (t) => {
  mock({
    [`${REPO_PATH}/packages/common`]: {},
  });

  const plan: ExecutionPlan = {
    workflow: {
      steps: [
        {
          expression: '.',
          adaptors: ['common'],
        },
      ],
    },
    options: {},
  };

  await mapAdaptorsToMonorepo([REPO_PATH], plan, logger);
  t.deepEqual(plan.workflow, {
    steps: [
      {
        expression: '.',
        adaptors: [`common=${REPO_PATH}/packages/common`],
      },
    ],
  });
});
