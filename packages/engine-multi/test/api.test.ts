import test from 'ava';
import createAPI from '../src/api';
import { createMockLogger } from '@openfn/logger';

// thes are tests on the public api functions generally
// so these are very high level tests and don't allow mock workers or anything

const logger = createMockLogger();

test.afterEach(() => {
  logger._reset();
});

test('create a default engine api without throwing', (t) => {
  createAPI();
  t.pass();
});

test('create an engine api with options without throwing', (t) => {
  createAPI({ logger });

  // just a token test to see if the logger is accepted and used
  t.assert(logger._history.length > 0);
});

test('create an engine api with a limited surface', (t) => {
  const api = createAPI({ logger });
  const keys = Object.keys(api);

  // TODO the api will actually probably get a bit bigger than this
  t.deepEqual(keys, ['execute', 'listen']);
});

// Note that this runs with the actual runtime worker
// I won't want to do deep testing on execute here - I just want to make sure the basic
// exeuction functionality is working. It's more a test of the api surface than the inner
// workings of the job
test('execute should return an event listener and receive workflow-complete', (t) => {
  return new Promise((done) => {
    const api = createAPI({
      logger,
      // Disable compilation
      compile: {
        skip: true,
      },
    });

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: 'export default [s => s]',
          // with no adaptor it shouldn't try to autoinstall
        },
      ],
    };

    const listener = api.execute(plan);
    listener.on('workflow-complete', () => {
      t.pass('workflow completed');
      done();
    });
  });
});

test('should listen to workflow-complete', (t) => {
  return new Promise((done) => {
    const api = createAPI({
      logger,
      // Disable compilation
      compile: {
        skip: true,
      },
    });

    const plan = {
      id: 'a',
      jobs: [
        {
          expression: 'export default [s => s]',
          // with no adaptor it shouldn't try to autoinstall
        },
      ],
    };

    api.execute(plan);
    api.listen(plan.id, {
      'workflow-complete': () => {
        t.pass('workflow completed');
        done();
      },
    });
  });
});
