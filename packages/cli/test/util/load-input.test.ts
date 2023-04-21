import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import loadInput from '../../src/util/load-input';
import { ExecutionPlan } from '@openfn/runtime';

const logger = createMockLogger(undefined, { level: 'debug' });

test.after(() => {
  logger._reset();
  mock.restore();
});

mock({
  'test/job.js': 'x',
  'test/wf.json': JSON.stringify({
    start: 'a',
    jobs: [{ id: 'a', expression: 'x()' }],
  }),
  'test/wf-err.json': '!!!',
});

test.serial('do nothing if no path provided', async (t) => {
  const opts = {};

  const result = await loadInput(opts, logger);
  t.falsy(result);
  t.assert(Object.keys(opts).length === 0);
});

test.serial('return the workflow if already set ', async (t) => {
  const opts = {
    workflow: { start: 'x', jobs: [] },
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

test.serial('load a workflow from a path and mutate opts', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    workflow: undefined,
  };

  await loadInput(opts, logger);
  t.is((opts.workflow as any).start, 'a');
});

test.serial('throw if workflow json is invalid', async (t) => {
  const opts = {
    workflowPath: 'test/wf-err.json',
  };

  await t.throwsAsync(() => loadInput(opts, logger));
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
    mock.restore();
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
    mock.restore();
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
  mock.restore();
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
  mock.restore();
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
        { configuration: 'config.json' },
        { configuration: './config.json' },
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
