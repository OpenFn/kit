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
  const attempt: Attempt = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
  };
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [createJob()],
  });
});

test('Accept a partial attempt object', (t) => {
  const attempt: Attempt = {
    id: 'w',
  };
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [],
  });
});

test('convert a single trigger', (t) => {
  const attempt: Attempt = {
    id: 'w',
    triggers: [createTrigger()],
    jobs: [],
    edges: [],
  };
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [
      {
        id: 't',
      },
    ],
  });
});

// This exhibits current behaviour. This should never happen though
test('ignore a single edge', (t) => {
  const attempt: Attempt = {
    id: 'w',
    jobs: [],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [],
  });
});

test('convert a single trigger with an edge', (t) => {
  const attempt: Attempt = {
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
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [
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
  const attempt: Attempt = {
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
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [
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

test('convert two linked jobs', (t) => {
  const attempt: Attempt = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [createJob({ id: 'a', next: { b: true } }), createJob({ id: 'b' })],
  });
});

// This isn't supported by the runtime, but it'll survive the conversion
test('convert a job with two upstream jobs', (t) => {
  const attempt: Attempt = {
    id: 'w',
    jobs: [
      createNode({ id: 'a' }),
      createNode({ id: 'b' }),
      createNode({ id: 'x' }),
    ],
    triggers: [],
    edges: [createEdge('a', 'x'), createEdge('b', 'x')],
  };
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [
      createJob({ id: 'a', next: { x: true } }),
      createJob({ id: 'b', next: { x: true } }),
      createJob({ id: 'x' }),
    ],
  });
});

test('convert two linked jobs with an edge condition', (t) => {
  const condition = 'state.age > 10';
  const attempt: Attempt = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition })],
  };
  const result = convertAttempt(attempt);

  t.deepEqual(result, {
    id: 'w',
    plan: [
      createJob({ id: 'a', next: { b: { expression: condition } } }),
      createJob({ id: 'b' }),
    ],
  });
});
