import test from 'ava';
import mock from 'mock-fs';
import { createMockLogger } from '@openfn/logger';
import type { Job } from '@openfn/lexicon';

import loadPlan from '../../src/util/load-plan';
import { Opts } from '../../src/options';

const logger = createMockLogger(undefined, { level: 'debug' });

const sampleXPlan = {
  options: { start: 'a' },
  workflow: {
    name: 'wf',
    steps: [{ id: 'a', expression: 'x()' }],
  },
};

const createPlan = (steps: Job[] = []) => ({
  workflow: {
    steps,
  },
  options: {
    start: steps[0]?.id ?? 'a',
  },
});

test.beforeEach(() => {
  mock({
    'test/job.js': 'x',
    'test/wf-old.json': JSON.stringify({
      start: 'a',
      jobs: [{ id: 'a', expression: 'x()' }],
    }),
    'test/wf.json': JSON.stringify(sampleXPlan),
    'test/wf-err.json': '!!!',
  });
});

test.afterEach(() => {
  logger._reset();
  mock.restore();
});

test.serial('expression: load a plan from an expression.js', async (t) => {
  const opts = {
    expressionPath: 'test/job.js',
    plan: {},
  };

  const plan = await loadPlan(opts, logger);

  t.truthy(plan);
  t.deepEqual(plan.options, {});
  t.is(plan.workflow.steps.length, 1);
  t.is(plan.workflow.name, 'job');
  t.deepEqual(plan.workflow.steps[0], {
    expression: 'x',
  });
});

test.serial('expression: set an adaptor on the plan', async (t) => {
  const opts = {
    expressionPath: 'test/job.js',
    // Note that adaptor expansion should have happened before loadPlan is called
    adaptors: ['@openfn/language-common'],
  } as Partial<Opts>;

  const plan = await loadPlan(opts as Opts, logger);

  const step = plan.workflow.steps[0] as Job;

  t.is(step.adaptor, '@openfn/language-common');
});

test.serial('expression: do not expand adaptors', async (t) => {
  const opts = {
    expressionPath: 'test/job.js',
    expandAdaptors: false,
    // Note that adaptor expansion should have happened before loadPlan is called
    adaptors: ['common'],
  } as Partial<Opts>;

  const plan = await loadPlan(opts as Opts, logger);

  const step = plan.workflow.steps[0] as Job;

  t.is(step.adaptor, 'common');
});

test.serial('expression: set a timeout on the plan', async (t) => {
  const opts = {
    expressionPath: 'test/job.js',
    expandAdaptors: true,
    timeout: 111,
  } as Partial<Opts>;

  const plan = await loadPlan(opts as Opts, logger);

  t.is(plan.options.timeout, 111);
});

test.serial('expression: set a start on the plan', async (t) => {
  const opts = {
    expressionPath: 'test/job.js',
    start: 'x',
  } as Partial<Opts>;

  const plan = await loadPlan(opts as Opts, logger);

  t.is(plan.options.start, 'x');
});

test.serial('xplan: load a plan from workflow path', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    expandAdaptors: true,
    plan: {},
  };

  const plan = await loadPlan(opts, logger);

  t.truthy(plan);
  t.deepEqual(plan, sampleXPlan);
});

test.serial('xplan: expand adaptors', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    expandAdaptors: true,
    plan: {},
  };

  const plan = createPlan([
    {
      id: 'a',
      expression: '.',
      adaptor: 'common@1.0.0',
    },
  ]);

  mock({
    'test/wf.json': JSON.stringify(plan),
  });

  const result = await loadPlan(opts, logger);
  t.truthy(result);

  const step = result.workflow.steps[0] as Job;
  t.is(step.adaptor, '@openfn/language-common@1.0.0');
});

test.serial('xplan: do not expand adaptors', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    expandAdaptors: false,
    plan: {},
  };

  const plan = createPlan([
    {
      id: 'a',
      expression: '.',
      adaptor: 'common@1.0.0',
    },
  ]);

  mock({
    'test/wf.json': JSON.stringify(plan),
  });

  const result = await loadPlan(opts, logger);
  t.truthy(result);

  const step = result.workflow.steps[0] as Job;
  t.is(step.adaptor, 'common@1.0.0');
});

test.serial('xplan: set timeout from CLI', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    timeout: 666,
    plan: {},
  };

  const plan = createPlan([
    {
      id: 'a',
      expression: '.',
    },
  ]);
  // The incoming option should overwrite this one
  // @ts-ignore
  plan.options.timeout = 1;

  mock({
    'test/wf.json': JSON.stringify(plan),
  });

  const { options } = await loadPlan(opts, logger);
  t.is(options.timeout, 666);
});

test.serial('xplan: set start from CLI', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    start: 'b',
    plan: {},
  };

  const plan = createPlan([
    {
      id: 'a',
      expression: '.',
    },
  ]);
  // The incoming option should overwrite this one
  // @ts-ignore
  plan.options.start = 'a';

  mock({
    'test/wf.json': JSON.stringify(plan),
  });

  const { options } = await loadPlan(opts, logger);
  t.is(options.start, 'b');
});

test.serial('xplan: map to monorepo', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    expandAdaptors: true,
    plan: {},
    monorepoPath: '/repo/',
  } as Partial<Opts>;

  const plan = createPlan([
    {
      id: 'a',
      expression: '.',
      adaptor: 'common',
    },
  ]);

  mock({
    'test/wf.json': JSON.stringify(plan),
  });

  const result = await loadPlan(opts as Opts, logger);
  t.truthy(result);

  const step = result.workflow.steps[0] as Job;
  t.is(step.adaptor, '@openfn/language-common=/repo/packages/common');
});

test.serial('old-workflow: load a plan from workflow path', async (t) => {
  const opts = {
    workflowPath: 'test/wf-old.json',
    plan: {},
  };

  const plan = await loadPlan(opts, logger);

  t.deepEqual(plan.options, {
    start: 'a',
  });
  t.is(plan.workflow.steps.length, 1);
  t.is(plan.workflow.name, 'wf-old');
  t.deepEqual(plan.workflow.steps[0], {
    id: 'a',
    expression: 'x()',
  });
});

test.serial('step: allow file paths for state', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    plan: {},
  };

  const plan = createPlan([
    {
      id: 'a',
      expression: '.',
      state: './state.json',
    },
  ]);

  mock({
    'test/state.json': JSON.stringify({
      data: {
        x: 1
      }
    }),
    'test/wf.json': JSON.stringify(plan),
  });
  const result = await loadPlan(opts, logger);
  t.truthy(result);

  const step = result.workflow.steps[0] as Job;
  t.deepEqual(step.state, {
    data: {
      x: 1
    }
  });
});
