import test from 'ava';
import convertAttempt from '../../src/util/convert-attempt';
import { Attempt, Node } from '../../src/types';

// Creates a lightning node (job or trigger)
const createNode = (props = {}) =>
  ({
    id: 'a',
    body: 'x',
    adaptor: 'common',
    credential: 'y',
    ...props,
  } as Node);

const createEdge = (from, to, props = {}) => ({
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
  } as Node);

// Creates a runtime job node
const createJob = (props = {}) => ({
  id: 'a',
  expression: 'x',
  adaptor: 'common',
  configuration: 'y',
  ...props,
});

test('convert a single job', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob()],
  });
});

test('convert a single job with options', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
    options: {
      sanitize: 'obfuscate',
      timeout: 10,
    },
  };
  const { plan, options } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob()],
  });
  t.deepEqual(options, attempt.options);
});

// Note idk how lightningg will handle state/defaults on a job
// but this is what we'll do right now
test('convert a single job with data', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode({ state: { data: { x: 22 } } })],
    triggers: [],
    edges: [],
  };
  const { plan, options } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob({ state: { data: { x: 22 } } })],
  });
  t.deepEqual(options, {});
});

test('Accept a partial attempt object', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
  };
  const { plan, options } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [],
  });
  t.deepEqual(options, {});
});

test('handle dataclip_id', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    dataclip_id: 'xyz',
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    initialState: 'xyz',
    jobs: [],
  });
});

test('handle starting_node_id', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    starting_node_id: 'j1',
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    start: 'j1',
    jobs: [],
  });
});

test('convert a single trigger', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    triggers: [createTrigger()],
    jobs: [],
    edges: [],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      {
        id: 't',
      },
    ],
  });
});

// This exhibits current behaviour. This should never happen though
test('ignore a single edge', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [],
  });
});

test('convert a single trigger with an edge', (t) => {
  const attempt: Partial<Attempt> = {
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
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      {
        id: 't',
        next: {
          a: true,
        },
      },
      createJob(),
    ],
  });
});

test('convert a single trigger with two edges', (t) => {
  const attempt: Partial<Attempt> = {
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
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
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
  });
});

test('convert a disabled trigger', (t) => {
  const attempt: Partial<Attempt> = {
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
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      {
        id: 't',
        next: {},
      },
      createJob({ id: 'a' }),
    ],
  });
});

test('convert two linked jobs', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob({ id: 'a', next: { b: true } }), createJob({ id: 'b' })],
  });
});

// This isn't supported by the runtime, but it'll survive the conversion
test('convert a job with two upstream jobs', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [
      createNode({ id: 'a' }),
      createNode({ id: 'b' }),
      createNode({ id: 'x' }),
    ],
    triggers: [],
    edges: [createEdge('a', 'x'), createEdge('b', 'x')],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      createJob({ id: 'a', next: { x: true } }),
      createJob({ id: 'b', next: { x: true } }),
      createJob({ id: 'x' }),
    ],
  });
});

test('convert two linked jobs with an edge condition', (t) => {
  const condition = 'state.age > 10';
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition })],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      createJob({ id: 'a', next: { b: { condition } } }),
      createJob({ id: 'b' }),
    ],
  });
});

test('convert two linked jobs with a disabled edge', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { enabled: false })],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      createJob({ id: 'a', next: { b: { disabled: true } } }),
      createJob({ id: 'b' }),
    ],
  });
});

test('convert edge condition on_job_success', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition: 'on_job_success' })],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  const [job] = plan.jobs;

  t.truthy(job.next?.b);
  t.is(job.next.b.condition, '!state.errors');
});

test('convert edge condition on_job_failure', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition: 'on_job_failure' })],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  const [job] = plan.jobs;

  t.truthy(job.next?.b);
  t.is(job.next.b.condition, 'state.errors');
});

test('convert edge condition always', (t) => {
  const attempt: Partial<Attempt> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition: 'always' })],
  };
  const { plan } = convertAttempt(attempt as Attempt);

  const [job] = plan.jobs;

  t.false(job.next.b.hasOwnProperty('condition'));
});
