import test from 'ava';
import type {
  LightningPlan,
  LightningJob,
  LightningTrigger,
} from '@openfn/lexicon/lightning';
import convertPlan from '../../src/util/convert-lightning-plan';
import { Job } from '@openfn/lexicon';

// Creates a lightning node (job or trigger)
const createNode = (props = {}) =>
  ({
    id: 'a',
    body: 'x',
    adaptor: 'common',
    credential_id: 'y',
    ...props,
  } as LightningJob);

const createEdge = (from: string, to: string, props = {}) => ({
  id: `${from}-${to}`,
  source_job_id: from,
  target_job_id: to,
  ...props,
});

// Creates a lightning trigger
const createTrigger = (props = {}) =>
  ({
    id: 't',
    type: 'cron',
    ...props,
  } as LightningTrigger);

// Creates a runtime job node
const createJob = (props = {}) => ({
  id: 'a',
  expression: 'x',
  adaptors: ['common'],
  configuration: 'y',
  ...props,
});

test('convert a single job', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [createJob()],
    },
  });
});

test('convert a single job with names', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    name: 'my-workflow',
    jobs: [createNode({ name: 'my-job' })],
    triggers: [],
    edges: [],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      name: 'my-workflow',
      steps: [createJob({ name: 'my-job' })],
    },
  });
});

test('convert a single job with options', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
    options: {
      sanitize: 'obfuscate',
      run_timeout_ms: 10,
      run_memory_limit_mb: 500,
      payload_limit_mb: 20,
    },
  };
  const { plan, options } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [createJob()],
    },
  });
  t.deepEqual(options, {
    runTimeoutMs: 10,
    memoryLimitMb: 500,
    payloadLimitMb: 20,
    sanitize: 'obfuscate',
  });
});

test('convert a single job with log_payload_limit_mb', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
    options: {
      sanitize: 'obfuscate',
      run_timeout_ms: 10,
      run_memory_limit_mb: 500,
      payload_limit_mb: 20,
      log_payload_limit_mb: 2,
    },
  };
  const { plan, options } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [createJob()],
    },
  });
  t.deepEqual(options, {
    runTimeoutMs: 10,
    memoryLimitMb: 500,
    payloadLimitMb: 20,
    logPayloadLimitMb: 2,
    sanitize: 'obfuscate',
  });
});

// Note idk how lightningg will handle state/defaults on a job
// but this is what we'll do right now
test('convert a single job with data', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode({ state: { data: { x: 22 } } })],
    triggers: [],
    edges: [],
  };
  const { plan, options } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [createJob({ state: { data: { x: 22 } } })],
    },
  });
  t.deepEqual(options, {});
});

test('Accept a partial run object', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
  };
  const { plan, options } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [],
    },
  });
  t.deepEqual(options, {});
});

test('handle dataclip_id as input', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    dataclip_id: 'xyz',
  };
  const { input } = convertPlan(run as LightningPlan);

  t.deepEqual(input, 'xyz');
});

test('handle starting_node_id as options', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    starting_node_id: 'j1',
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan.options, {
    start: 'j1',
  });
});

test('handle output_dataclip as options', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    options: {
      output_dataclips: false,
    },
  };
  const { options } = convertPlan(run as LightningPlan);
  t.deepEqual(options, {
    outputDataclips: false,
  });
});

test('convert a single trigger', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    triggers: [createTrigger()],
    jobs: [],
    edges: [],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        {
          id: 't',
        },
      ],
    },
  });
});

// This exhibits current behaviour. This should never happen though
test('ignore a single edge', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [],
    },
  });
});

test('convert a single trigger with an edge', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    triggers: [createTrigger()],
    jobs: [createNode()],
    edges: [
      {
        id: 'w-t',
        source_trigger_id: 't',
        target_job_id: 'a',
      },
    ],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        {
          id: 't',
          next: {
            a: true,
          },
        },
        createJob(),
      ],
    },
  });
});

test('convert a single trigger with two edges', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    triggers: [createTrigger()],
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    edges: [
      {
        id: 't-a',
        source_trigger_id: 't',
        target_job_id: 'a',
      },
      {
        id: 't-b',
        source_trigger_id: 't',
        target_job_id: 'b',
      },
    ],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        {
          id: 't',
          next: {
            a: true,
            b: true,
          },
        },
        createJob({ id: 'a' }),
        createJob({ id: 'b' }),
      ],
    },
  });
});

test('convert a disabled trigger', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    triggers: [createTrigger()],
    jobs: [createNode({ id: 'a' })],
    edges: [
      {
        id: 't-a',
        source_trigger_id: 't',
        target_job_id: 'a',
        enabled: false,
      },
    ],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        {
          id: 't',
          next: {},
        },
        createJob({ id: 'a' }),
      ],
    },
  });
});

test('convert two linked jobs', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        createJob({ id: 'a', next: { b: true } }),
        createJob({ id: 'b' }),
      ],
    },
  });
});

// This isn't supported by the runtime, but it'll survive the conversion
test('convert a job with two upstream jobs', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [
      createNode({ id: 'a' }),
      createNode({ id: 'b' }),
      createNode({ id: 'x' }),
    ],
    triggers: [],
    edges: [createEdge('a', 'x'), createEdge('b', 'x')],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        createJob({ id: 'a', next: { x: true } }),
        createJob({ id: 'b', next: { x: true } }),
        createJob({ id: 'x' }),
      ],
    },
  });
});

test('convert two linked jobs with an edge condition', (t) => {
  const condition = 'state.age > 10';
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition })],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        createJob({ id: 'a', next: { b: { condition } } }),
        createJob({ id: 'b' }),
      ],
    },
  });
});

test('convert two linked jobs with a disabled edge', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { enabled: false })],
  };
  const { plan } = convertPlan(run as LightningPlan);

  t.deepEqual(plan, {
    id: 'w',
    options: {},
    workflow: {
      steps: [
        createJob({ id: 'a', next: { b: { disabled: true } } }),
        createJob({ id: 'b' }),
      ],
    },
  });
});

test('append the collections adaptor to jobs that use it', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [
      createNode({ id: 'a' }),
      createNode({
        id: 'b',
        body: 'collections.each("c", "k", (state) => state)',
      }),
    ],
    triggers: [{ id: 't', type: 'cron' }],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertPlan(run as LightningPlan, {
    collectionsVersion: '1.0.0',
  });

  const [_t, a, b] = plan.workflow.steps;

  // @ts-ignore
  t.deepEqual(a.adaptors, ['common']);
  // @ts-ignore
  t.deepEqual(b.adaptors, ['common', '@openfn/language-collections@1.0.0']);
});

test('do not append the collections adaptor to jobs that already have it', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [
      createNode({
        id: 'a',
        body: 'collections.each("c", "k", (state) => state)',
        adaptor: '@openfn/language-collections@latest',
      }),
    ],
    triggers: [{ id: 't', type: 'cron' }],
    edges: [createEdge('t', 'a')],
  };

  const { plan } = convertPlan(run as LightningPlan, {
    collectionsVersion: '1.0.0',
  });

  const [_t, a] = plan.workflow.steps;

  // @ts-ignore
  t.deepEqual(a.adaptors, ['@openfn/language-collections@latest']);

  t.deepEqual(plan.workflow.credentials, {
    collections_token: true,
    collections_endpoint: true,
  });
});

test('append the collections credential to workflows that use it', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [
      createNode({ id: 'a' }),
      createNode({
        id: 'b',
        body: 'collections.each("c", "k", (state) => state)',
      }),
    ],
    triggers: [{ id: 't', type: 'cron' }],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertPlan(run as LightningPlan, {
    collectionsVersion: '1.0.0',
  });

  const creds = plan.workflow.credentials;

  t.deepEqual(creds, {
    collections_token: true,
    collections_endpoint: true,
  });
});

test("Don't set up collections if no version is passed", (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [
      createNode({
        id: 'a',
        body: 'collections.each("c", "k", (state) => state)',
        adaptor: 'common',
      }),
    ],
    triggers: [{ id: 't', type: 'cron' }],
    edges: [createEdge('t', 'a')],
  };
  const { plan } = convertPlan(run as LightningPlan);

  const [_t, a] = plan.workflow.steps;

  t.deepEqual((a as Job).adaptors, ['common']);
  t.falsy(plan.workflow.credentials);
});

test('Use local paths', (t) => {
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [
      createNode({
        id: 'a',
        body: 'collections.each("c", "k", (state) => state)',
        adaptor: 'common@local',
      }),
    ],
    triggers: [{ id: 't', type: 'cron' }],
    edges: [createEdge('t', 'a')],
  };

  const { plan } = convertPlan(run as LightningPlan, {
    collectionsVersion: 'local',
    monorepoPath: '/adaptors',
  });

  const [_t, a] = plan.workflow.steps as any[];

  t.deepEqual(a.adaptors, [
    'common@local',
    '@openfn/language-collections@local',
  ]);
  t.deepEqual(a.linker, {
    // The adaptor is not exapanded into long form, could be a problem
    common: {
      path: '/adaptors/packages/common',
      version: 'local',
    },
    '@openfn/language-collections': {
      path: '/adaptors/packages/collections',
      version: 'local',
    },
  });
});

test('pass globals from lightning run to plan', (t) => {
  const GLOBALS_CONTENT = "export const prefixer = (v) => 'prefix-' + v";
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode({ id: 'a' })],
    globals: GLOBALS_CONTENT,
  };

  const { plan } = convertPlan(run as LightningPlan);
  t.deepEqual(plan.workflow.globals, GLOBALS_CONTENT);
});

test("ignore globals when it isn't a string", (t) => {
  const GLOBALS_CONTENT = { some: 'value' }; // not a string
  const run: Partial<LightningPlan> = {
    id: 'w',
    jobs: [createNode({ id: 'a' })],
    globals: GLOBALS_CONTENT as any,
  };

  const { plan } = convertPlan(run as LightningPlan);
  t.deepEqual(plan.workflow.globals, undefined);
});
