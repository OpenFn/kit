import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import mockfs from 'mock-fs';
import validateAdaptors from '../../src/util/validate-adaptors';

const logger = createMockLogger('', { level: 'default' });

test.afterEach(() => {
  logger._reset();
  mockfs.restore();
});

test.serial('should warn if expression passed with no adaptor', async (t) => {
  await validateAdaptors({ expressionPath: 'job.js', adaptors: [] }, logger);
  t.assert(logger._history.length > 1);
  const { message, level } = logger._parse(logger._history[0]);
  t.is(level, 'warn');
  t.regex(message as string, /No adaptor provided/);
});

test.serial(
  'should NOT warn if no adaptor ifskip-adaptor-warning is set',
  async (t) => {
    await validateAdaptors(
      { expressionPath: 'job.js', adaptors: [], skipAdaptorValidation: true },
      logger
    );
    t.is(logger._history.length, 0);
  }
);

test.serial(
  'should NOT warn if a workflow json is being used (workflow path)',
  async (t) => {
    await validateAdaptors({ adaptors: [], workflowPath: 'wf.json' }, logger);
    t.is(logger._history.length, 0);
  }
);

test.serial(
  'should NOT warn if a workflow yaml is being used (workflow path)',
  async (t) => {
    await validateAdaptors({ adaptors: [], workflowPath: 'wf.yaml' }, logger);
    t.is(logger._history.length, 0);
  }
);

test.serial('should NOT warn if a workflow json is being used', async (t) => {
  await validateAdaptors({ adaptors: [], planPath: 'wf.json' }, logger);
  t.is(logger._history.length, 0);
});

test.serial('should NOT warn if a workflow yaml is being used', async (t) => {
  await validateAdaptors({ adaptors: [], planPath: 'wf.yaml' }, logger);
  t.is(logger._history.length, 0);
});

test.serial('should NOT warn if a workflow name is used', async (t) => {
  await validateAdaptors(
    { adaptors: [], workflowName: 'my-workflow' } as any,
    logger
  );
  t.is(logger._history.length, 0);
});

test.serial('should throw if adaptors and workflow are passed', async (t) => {
  await t.throwsAsync(
    () =>
      validateAdaptors(
        { adaptors: ['common'], workflowPath: 'wf.json' },
        logger
      ),
    {
      message: 'adaptor and workflow provided',
    }
  );
});
