import test from 'ava';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/lexicon';

import createAPI from '../src/api';
import pkg from '../package.json' assert { type: 'json' };
import type { RuntimeEngine } from '../src/types';

// thes are tests on the public api functions generally
// so these are very high level tests and don't allow mock workers or anything

const logger = createMockLogger(undefined, { level: 'debug' });
let api: RuntimeEngine;

test.afterEach(() => {
  logger._reset();
  api?.destroy();
});

test.serial('create a default engine api without throwing', async (t) => {
  api = await createAPI();
  t.pass();
});

test.serial('create an engine api with options without throwing', async (t) => {
  api = await createAPI({ logger });
  // just a token test to see if the logger is accepted and used
  t.true(logger._history.length > 0);
});

test.serial('create an engine api with a limited surface', async (t) => {
  api = await createAPI({ logger });
  const keys = Object.keys(api).sort();

  // TODO the api will actually probably get a bit bigger than this
  t.deepEqual(
    keys,
    ['execute', 'listen', 'on', 'options', 'destroy', 'version'].sort()
  );
});

test.serial('engine api includes a version number', async (t) => {
  api = await createAPI({ logger });
  t.is(api.version, pkg.version);
});

test.serial('engine api uses default options', async (t) => {
  api = await createAPI({ logger });

  t.truthy(api.options);

  t.deepEqual(api.options.statePropsToRemove, ['configuration', 'response']);
  t.false(api.options.noCompile);
  t.truthy(api.options.whitelist);
});

test.serial('engine api uses custom options', async (t) => {
  const options = {
    logger, // no test

    repoDir: 'a/b/c',
    whitelist: ['/@openfn/'],

    // noCompile
    // autoinstall

    maxWorkers: 29,
    memoryLimitMb: 99,
    runTimeoutMs: 33,
    statePropsToRemove: ['z'],
  };

  api = await createAPI(options);

  t.truthy(api.options);

  t.is(api.options.repoDir, 'a/b/c');
  t.true(api.options.whitelist![0] instanceof RegExp);
  t.is(api.options.maxWorkers, 29);
  t.is(api.options.memoryLimitMb, 99);
  t.is(api.options.runTimeoutMs, 33);
  t.deepEqual(api.options.statePropsToRemove, ['z']);
});

// Note that this runs with the actual runtime worker
// I won't want to do deep testing on execute here - I just want to make sure the basic
// exeuction functionality is working. It's more a test of the api surface than the inner
// workings of the job
test.serial(
  'execute should return an event listener and receive workflow-complete',
  async (t) => {
    return new Promise(async (done) => {
      api = await createAPI({
        logger,
        // Disable compilation
        compile: {
          skip: true,
        },
      });

      const plan: ExecutionPlan = {
        id: 'a',
        workflow: {
          steps: [
            {
              expression: 'export default [s => s]',
              // with no adaptor it shouldn't try to autoinstall
            },
          ],
        },
        options: {},
      };

      const state = { x: 1 };
      const listener = api.execute(plan, state);
      listener.on('workflow-complete', () => {
        t.pass('workflow completed');
        done();
      });
    });
  }
);

test.serial('should listen to workflow-complete', async (t) => {
  return new Promise(async (done) => {
    api = await createAPI({
      logger,
      // Disable compilation
      compile: {
        skip: true,
      },
    });

    const plan: ExecutionPlan = {
      id: 'a',
      workflow: {
        steps: [
          {
            expression: 'export default [s => s]',
            // with no adaptor it shouldn't try to autoinstall
          },
        ],
      },
      options: {},
    };
    const state = { x: 1 };
    api.execute(plan, state);

    api.listen(plan.id!, {
      'workflow-complete': () => {
        t.pass('workflow completed');
        done();
      },
    });
  });
});
