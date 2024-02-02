import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import type { ExecutionPlan } from '@openfn/lexicon';

import loadInput from '../../src/util/load-input';

const logger = createMockLogger(undefined, { level: 'debug' });

// TODO add support for handling old versions here
test.beforeEach(() => {
  mock({
    'test/job.js': 'x',
    'test/wf-old.json': JSON.stringify({
      start: 'a',
      jobs: [{ id: 'a', expression: 'x()' }],
    }),
    'test/wf.json': JSON.stringify({
      options: { start: 'a' },
      workflow: {
        // TODO rename steps
        jobs: [{ id: 'a', expression: 'x()' }],
      },
    }),
    'test/wf-err.json': '!!!',
  });
});

test.afterEach(() => {
  logger._reset();
  mock.restore();
});

test.serial('do nothing if no path provided', async (t) => {
  const opts = {};

  const result = await loadInput(opts, logger);
  t.falsy(result);
  t.assert(Object.keys(opts).length === 0);
});

test.serial('return the workflow if already set ', async (t) => {
  const opts = {
    workflow: { options: { start: 'x' }, jobs: [] },
    job: 'j',
    jobPath: 'test/job.js',
  };

  const result = (await loadInput(opts, logger)) as ExecutionPlan;
  t.truthy(result);
  t.is(result.start, 'x');
});

test.serial(
  'return the job if already set (and workflow is not)',
  async (t) => {
    const opts = {
      job: 'j',
      jobPath: 'test/job.js',
    };

    const result = await loadInput(opts, logger);
    t.is(result, 'j');
  }
);

test.serial('load a job from a path and return the result', async (t) => {
  const opts = {
    jobPath: 'test/job.js',
  };

  const result = await loadInput(opts, logger);
  t.is(result, 'x');
});

test.serial('load a job from a path and mutate opts', async (t) => {
  const opts = {
    jobPath: 'test/job.js',
    job: '',
  };

  await loadInput(opts, logger);
  t.is(opts.job, 'x');
});

test.serial('abort if the job cannot be found', async (t) => {
  const opts = {
    jobPath: 'test/blah.js',
  };

  const logger = createMockLogger();
  await t.throwsAsync(() => loadInput(opts, logger));

  t.assert(logger._find('error', /job not found/i));
  t.assert(
    logger._find('always', /Failed to load the job from test\/blah.js/i)
  );
  t.assert(logger._find('error', /critical error: aborting command/i));
});

test.serial(
  'load a workflow from a path and return the result as JSON',
  async (t) => {
    const opts = {
      workflowPath: 'test/wf.json',
    };

    const result = await loadInput(opts, logger);
    t.is(result.start, 'a');
  }
);

test.serial('abort if the workflow cannot be found', async (t) => {
  const opts = {
    workflowPath: 'test/blah.json',
  };

  const logger = createMockLogger();
  await t.throwsAsync(() => loadInput(opts, logger));

  t.assert(logger._find('error', /workflow not found/i));
  t.assert(
    logger._find('always', /Failed to load a workflow from test\/blah.json/i)
  );
  t.assert(logger._find('error', /critical error: aborting command/i));
});

test.serial('abort if the workflow contains invalid json', async (t) => {
  const opts = {
    workflowPath: 'test/wf-err.json',
  };

  const logger = createMockLogger();
  await t.throwsAsync(() => loadInput(opts, logger));

  t.assert(logger._find('error', /invalid json in workflow/i));
  t.assert(
    logger._find('always', /check the syntax of the json at test\/wf-err.json/i)
  );
  t.assert(logger._find('error', /critical error: aborting command/i));
});

test.serial('load a workflow from a path and mutate opts', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    workflow: undefined,
  };

  await loadInput(opts, logger);
  t.is((opts.workflow as any).start, 'a');
});

test.serial('prefer workflow to job if both are somehow set', async (t) => {
  const opts = {
    jobPath: 'test/job.js',
    workflowPath: 'test/wf.json',
  };

  const result = await loadInput(opts, logger);
  t.is(result.start, 'a');
});

test.serial('resolve workflow expression paths (filename)', async (t) => {
  mock({
    '/test/job.js': 'x',
    '/test/wf.json': JSON.stringify({
      jobs: [{ expression: 'job.js' }],
    }),
  });

  const opts = {
    workflowPath: '/test/wf.json',
  };

  const result = (await loadInput(opts, logger)) as ExecutionPlan;
  t.is(result.jobs[0].expression, 'x');
});

test.serial(
  'resolve workflow expression paths (relative same dir)',
  async (t) => {
    mock({
      '/test/job.js': 'x',
      '/test/wf.json': JSON.stringify({
        jobs: [{ expression: './job.js' }],
      }),
    });

    const opts = {
      workflowPath: '/test/wf.json',
    };

    const result = (await loadInput(opts, logger)) as ExecutionPlan;
    t.is(result.jobs[0].expression, 'x');
  }
);

test.serial(
  'resolve workflow expression paths (relative different dir)',
  async (t) => {
    mock({
      '/jobs/job.js': 'x',
      '/test/wf.json': JSON.stringify({
        jobs: [{ expression: '../jobs/job.js' }],
      }),
    });

    const opts = {
      workflowPath: '/test/wf.json',
    };

    const result = (await loadInput(opts, logger)) as ExecutionPlan;
    t.is(result.jobs[0].expression, 'x');
  }
);

test.serial('resolve workflow expression paths (absolute)', async (t) => {
  mock({
    '/job.js': 'x',
    '/test/wf.json': JSON.stringify({
      start: 'a',
      jobs: [{ expression: '/job.js' }],
    }),
  });

  const opts = {
    workflowPath: '/test/wf.json',
  };

  const result = (await loadInput(opts, logger)) as ExecutionPlan;
  t.is(result.jobs[0].expression, 'x');
});

test.serial('resolve workflow expression paths (home)', async (t) => {
  mock({
    '~/job.js': 'x',
    '/test/wf.json': JSON.stringify({
      jobs: [{ expression: '~/job.js' }],
    }),
  });

  const opts = {
    workflowPath: '/test/wf.json',
  };

  const result = (await loadInput(opts, logger)) as ExecutionPlan;
  t.is(result.jobs[0].expression, 'x');
});

test.serial('Load a workflow path with trailing spaces', async (t) => {
  const opts = {
    workflow: { jobs: [{ expression: 'test/job.js  ' }] },
  };

  const result = (await loadInput(opts, logger)) as ExecutionPlan;
  t.is(result.jobs[0].expression, 'x');
});

// Less thorough testing on config because it goes through the same code
test.serial('resolve workflow config paths (home)', async (t) => {
  const cfg = { id: 'x' };
  const cfgString = JSON.stringify(cfg);
  mock({
    '~/config.json': cfgString,
    '/config.json': cfgString,
    '/test/config.json': cfgString,
    '/test/wf.json': JSON.stringify({
      jobs: [
        { configuration: '/config.json' },
        { configuration: '~/config.json' },
        { configuration: 'config.json ' }, // trailing spaces!
        { configuration: './config.json  ' },
      ],
    }),
  });

  const opts = {
    workflowPath: '/test/wf.json',
  };

  const result = (await loadInput(opts, logger)) as ExecutionPlan;
  t.is(result.jobs.length, 4);
  for (const job of result.jobs) {
    t.deepEqual(job.configuration, cfg);
  }
});

test.serial(
  'abort if a workflow expression path cannot be found',
  async (t) => {
    const opts = {
      workflow: { start: 'x', jobs: [{ id: 'a', expression: 'err.js' }] },
    };

    const logger = createMockLogger();
    await t.throwsAsync(() => loadInput(opts, logger));

    t.assert(logger._find('error', /file not found for job a: err.js/i));
    t.assert(
      logger._find(
        'always',
        /This workflow references a file which cannot be found/i
      )
    );
    t.assert(logger._find('error', /critical error: aborting command/i));
  }
);

test.serial(
  'abort if a workflow expression path cannot be found for an anonymous job',
  async (t) => {
    const opts = {
      workflow: {
        start: 'x',
        jobs: [{ expression: 'jam()' }, { expression: 'err.js' }],
      },
    };

    const logger = createMockLogger();
    await t.throwsAsync(() => loadInput(opts, logger));

    t.assert(logger._find('error', /file not found for job 2: err.js/i));
    t.assert(
      logger._find(
        'always',
        /This workflow references a file which cannot be found/i
      )
    );
    t.assert(logger._find('error', /critical error: aborting command/i));
  }
);
