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
    steps: [{ id: 'a', expression: 'x()', adaptors: [] }],
  },
};

const createPlan = (steps: Partial<Job>[] = []) => ({
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
    'test/collections.js': 'collections.get()',
    'test/wf-old.json': JSON.stringify({
      start: 'a',
      jobs: [{ id: 'a', expression: 'x()' }],
    }),
    'test/wf.json': JSON.stringify(sampleXPlan),
    'test/wf-flat.json': JSON.stringify(sampleXPlan.workflow),
    'test/wf-err.json': '!!!',
  });
});

test.afterEach(() => {
  logger._reset();
  mock.restore();
});

// TODO: add some tests for handling yaml stuff

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
    adaptors: [],
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

  t.is(step.adaptors[0], '@openfn/language-common');
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

  t.is(step.adaptors[0], 'common');
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

test.serial('expression: load the collections adaptor', async (t) => {
  const opts = {
    expressionPath: 'test/collections.js',
  } as Partial<Opts>;

  const plan = await loadPlan(opts as Opts, logger);

  t.deepEqual(plan.workflow.steps[0].adaptors, [
    '@openfn/language-collections@latest',
  ]);
});

test.serial(
  'expression: load the collections adaptor with another',
  async (t) => {
    const opts = {
      expressionPath: 'test/collections.js',
      adaptors: ['@openfn/language-common@latest'],
    } as Partial<Opts>;

    const plan = await loadPlan(opts as Opts, logger);

    t.deepEqual(plan.workflow.steps[0].adaptors, [
      '@openfn/language-common@latest',
      '@openfn/language-collections@latest',
    ]);
  }
);
test.serial(
  'expression: load the collections adaptor with a specific version',
  async (t) => {
    const opts = {
      expressionPath: 'test/collections.js',
      collectionsVersion: '1.1.1',
    } as Partial<Opts>;

    const plan = await loadPlan(opts as Opts, logger);

    t.deepEqual(plan.workflow.steps[0].adaptors, [
      '@openfn/language-collections@1.1.1',
    ]);
  }
);

test.serial('xplan: load an old-style plan from workflow path', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    expandAdaptors: true,
    plan: {},
  };

  const plan = await loadPlan(opts, logger);

  t.truthy(plan);
  t.deepEqual(plan, sampleXPlan);
});

test.serial('xplan: load a new flat plan from workflow path', async (t) => {
  const opts = {
    workflowPath: 'test/wf-flat.json',
    expandAdaptors: true,
    plan: {},
  };

  const plan = await loadPlan(opts, logger);

  t.truthy(plan);
  t.deepEqual(plan, {
    options: {}, // no options here!
    workflow: sampleXPlan.workflow,
  });
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
  t.is(step.adaptors[0], '@openfn/language-common@1.0.0');
  // @ts-ignore
  t.is(step.adaptor, undefined);
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
  t.is(step.adaptors[0], 'common@1.0.0');
  // @ts-ignore
  t.is(step.adaptor, undefined);
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
  t.is(step.adaptors[0], '@openfn/language-common=/repo/packages/common');
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
    adaptors: [],
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
        x: 1,
      },
    }),
    'test/wf.json': JSON.stringify(plan),
  });
  const result = await loadPlan(opts, logger);
  t.truthy(result);

  const step = result.workflow.steps[0] as Job;
  t.deepEqual(step.state, {
    data: {
      x: 1,
    },
  });
});

test.serial('xplan: support multiple adaptors', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    expandAdaptors: true,
    plan: {},
  };

  const plan = createPlan([
    {
      id: 'a',
      expression: '.',
      adaptors: ['common@1.0.0', '@openfn/language-collections@1.0.0'],
    },
  ]);

  mock({
    'test/wf.json': JSON.stringify(plan),
  });

  const result = await loadPlan(opts, logger);
  t.truthy(result);

  const step = result.workflow.steps[0] as Job;
  t.deepEqual(step.adaptors, [
    '@openfn/language-common@1.0.0',
    '@openfn/language-collections@1.0.0',
  ]);
  // @ts-ignore
  t.is(step.adaptor, undefined);
});

test.serial('xplan: append collections', async (t) => {
  const opts = {
    workflowPath: 'test/wf.json',
    collectionsVersion: '1.1.1',
    collectionsEndpoint: 'https://localhost:4000/',
    apiKey: 'abc',
  };

  const plan = createPlan([
    {
      id: 'a',
      expression: 'collections.get()',
      adaptors: ['@openfn/language-common@1.0.0'],
    },
  ]);

  mock({
    'test/wf.json': JSON.stringify(plan),
  });

  const result = await loadPlan(opts, logger);
  t.truthy(result);

  const step = result.workflow.steps[0] as Job;
  t.deepEqual(step.adaptors, [
    '@openfn/language-common@1.0.0',
    '@openfn/language-collections@1.1.1',
  ]);
  // @ts-ignore
  t.is(step.adaptor, undefined);

  t.deepEqual(step.configuration, {
    collections_endpoint: `${opts.collectionsEndpoint}/collections`,
    collections_token: opts.apiKey,
  });
});

test.serial(
  'xplan: load a workflow.yaml without top workflow key',
  async (t) => {
    mock({
      'test/wf.yaml': `
name: wf
steps:
  - id: a
    adaptors: []
    expression: x()
`,
    });
    const opts = {
      path: 'test/wf.yaml',
    };

    const plan = await loadPlan(opts, logger);

    t.truthy(plan);
    // Note that options are lost in this design!
    t.deepEqual(plan, { workflow: sampleXPlan.workflow, options: {} });
  }
);

test.serial(
  'xplan: load a workflow.yaml without top workflow key and options',
  async (t) => {
    mock({
      'test/wf.yaml': `
name: wf
steps:
  - id: a
    adaptors: []
    expression: x()
options:
  start: x
`,
    });
    const opts = {
      path: 'test/wf.yaml',
    };

    const plan = await loadPlan(opts, logger);

    t.truthy(plan);
    // Note that options are lost in this design!
    t.deepEqual(plan, {
      workflow: sampleXPlan.workflow,
      options: { start: 'x' },
    });
  }
);

test.serial('xplan: load a workflow.yaml with top workflow key', async (t) => {
  mock({
    'test/wf.yaml': `
workflow:
  name: wf
  steps:
    - id: a
      adaptors: []
      expression: x()
options:
  start: a
`,
  });
  const opts = {
    path: 'test/wf.yaml',
  };

  const plan = await loadPlan(opts, logger);

  t.truthy(plan);
  t.deepEqual(plan, sampleXPlan);
});

test.serial('xplan: load a workflow through a Workspace', async (t) => {
  mock({
    '/tmp/workflows/wf.yaml': `
id: wf
steps:
  - id: a
    expression: x()
`,
    '/tmp/openfn.yaml': `
dirs:
  workflows: /tmp/workflows
`,
  });

  const opts = {
    // TODO is worked out through yargs via the inputPath option
    workflowName: 'wf',
    workspace: '/tmp',
  };

  const plan = await loadPlan(opts, logger);
  t.truthy(plan);
  t.deepEqual(plan, {
    workflow: {
      id: 'wf',
      steps: [{ id: 'a', expression: 'x()', adaptors: [] }],
      history: [],
    },
    options: {},
  });
});

test.serial(
  'xplan: load a workflow through a project .yaml and apply the credentials map by default',
  async (t) => {
    mock({
      '/tmp/workflows/wf.yaml': `
id: wf
steps:
  - id: a
    expression: x()
start: a
`,
      '/tmp/openfn.yaml': `
credentials: /creds.yaml
dirs:
  workflows: /tmp/workflows
`,
      '/creds.yaml': `x: y`,
    });
    const opts = {
      workflowName: 'wf',
      workspace: '/tmp',
    };

    const plan = await loadPlan(opts, logger);

    t.truthy(plan);
    t.deepEqual(plan, {
      workflow: {
        id: 'wf',
        steps: [{ id: 'a', expression: 'x()', adaptors: [] }],
        history: [],
        start: 'a',
      },
      options: {},
    });

    t.is(opts.credentials, '/creds.yaml');
  }
);
