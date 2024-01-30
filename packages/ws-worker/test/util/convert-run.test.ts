import test from 'ava';
import convertRun, { conditions } from '../../src/util/convert-run';
import { Run, Node } from '../../src/types';

// Creates a lightning node (job or trigger)
const createNode = (props = {}) =>
  ({
    id: 'a',
    body: 'x',
    adaptor: 'common',
    credential_id: 'y',
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

const testEdgeCondition = (expr, state) => {
  const fn = new Function('state', 'return ' + expr);
  return fn(state);
};

test('convert a single job', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
  };
  const { plan } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob()],
  });
});

test('convert a single job with options', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode()],
    triggers: [],
    edges: [],
    options: {
      sanitize: 'obfuscate',
      runTimeoutMs: 10,
    },
  };
  const { plan, options } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob()],
  });
  t.deepEqual(options, run.options);
});

// Note idk how lightningg will handle state/defaults on a job
// but this is what we'll do right now
test('convert a single job with data', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ state: { data: { x: 22 } } })],
    triggers: [],
    edges: [],
  };
  const { plan, options } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob({ state: { data: { x: 22 } } })],
  });
  t.deepEqual(options, {});
});

test('Accept a partial run object', (t) => {
  const run: Partial<Run> = {
    id: 'w',
  };
  const { plan, options } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [],
  });
  t.deepEqual(options, {});
});

test('handle dataclip_id', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    dataclip_id: 'xyz',
  };
  const { plan } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    initialState: 'xyz',
    jobs: [],
  });
});

test('handle starting_node_id', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    starting_node_id: 'j1',
  };
  const { plan } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    start: 'j1',
    jobs: [],
  });
});

test('convert a single trigger', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    triggers: [createTrigger()],
    jobs: [],
    edges: [],
  };
  const { plan } = convertRun(run as Run);

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
  const run: Partial<Run> = {
    id: 'w',
    jobs: [],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [],
  });
});

test('convert a single trigger with an edge', (t) => {
  const run: Partial<Run> = {
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
  const { plan } = convertRun(run as Run);

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
  const run: Partial<Run> = {
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
  const { plan } = convertRun(run as Run);

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
  const run: Partial<Run> = {
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
  const { plan } = convertRun(run as Run);

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
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b')],
  };
  const { plan } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [createJob({ id: 'a', next: { b: true } }), createJob({ id: 'b' })],
  });
});

// This isn't supported by the runtime, but it'll survive the conversion
test('convert a job with two upstream jobs', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [
      createNode({ id: 'a' }),
      createNode({ id: 'b' }),
      createNode({ id: 'x' }),
    ],
    triggers: [],
    edges: [createEdge('a', 'x'), createEdge('b', 'x')],
  };
  const { plan } = convertRun(run as Run);

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
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition })],
  };
  const { plan } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      createJob({ id: 'a', next: { b: { condition } } }),
      createJob({ id: 'b' }),
    ],
  });
});

test('convert two linked jobs with a disabled edge', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { enabled: false })],
  };
  const { plan } = convertRun(run as Run);

  t.deepEqual(plan, {
    id: 'w',
    jobs: [
      createJob({ id: 'a', next: { b: { disabled: true } } }),
      createJob({ id: 'b' }),
    ],
  });
});

test('on_job_success condition: return true if no errors', (t) => {
  const condition = conditions.on_job_success('a');

  const state = {};
  const result = testEdgeCondition(condition, state);

  t.is(result, true);
});

// You can argue this both ways, but a job which returned no state is technically not in error
// Mostly I dont want it to blow up
test('on_job_success condition: return true if state is undefined', (t) => {
  const condition = conditions.on_job_success('a');

  const state = undefined;
  const result = testEdgeCondition(condition, state);

  t.is(result, true);
});

test('on_job_success condition: return true if unconnected upstream errors', (t) => {
  const condition = conditions.on_job_success('a');

  const state = {
    errors: {
      c: {
        // some error that occured upstream
      },
    },
  };
  const result = testEdgeCondition(condition, state);

  t.is(result, true);
});

test('on_job_success condition: return false if the upstream job errored', (t) => {
  const condition = conditions.on_job_success('a');

  const state = {
    errors: {
      a: {
        // some error that occured upstream
      },
    },
  };
  const result = testEdgeCondition(condition, state);

  t.is(result, false);
});

test('on_job_failure condition: return true if error immediately upstream', (t) => {
  const condition = conditions.on_job_failure('a');

  const state = {
    errors: {
      a: {
        // some error that occured upstream
      },
    },
  };
  const result = testEdgeCondition(condition, state);

  t.is(result, true);
});

test('on_job_failure condition: return false if unrelated error upstream', (t) => {
  const condition = conditions.on_job_failure('a');

  const state = {
    errors: {
      b: {
        // some error that occured upstream
      },
    },
  };
  const result = testEdgeCondition(condition, state);

  t.is(result, false);
});

test('on_job_failure condition: return false if no errors', (t) => {
  const condition = conditions.on_job_failure('a');

  const state = {};
  const result = testEdgeCondition(condition, state);

  t.is(result, false);
});

test('on_job_failure condition: return false if state is undefined', (t) => {
  const condition = conditions.on_job_failure('a');

  const state = undefined;
  const result = testEdgeCondition(condition, state);

  t.is(result, false);
});

test('convert edge condition on_job_success', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition: 'on_job_success' })],
  };
  const { plan } = convertRun(run as Run);

  const [job] = plan.jobs;

  t.truthy(job.next?.b);
  t.is(job.next.b.condition, conditions.on_job_success('a'));

  t.true(testEdgeCondition(job.next.b.condition, {}));
});

test('convert edge condition on_job_failure', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition: 'on_job_failure' })],
  };
  const { plan } = convertRun(run as Run);

  const [job] = plan.jobs;

  t.truthy(job.next?.b);
  t.is(job.next.b.condition, conditions.on_job_failure('a'));

  // Check that this is valid js
  t.true(
    testEdgeCondition(job.next.b.condition, {
      errors: { a: {} },
    })
  );
});

test('convert edge condition on_job_success with a funky id', (t) => {
  const id_a = 'a-b-c@ # {} !£';
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ id: id_a }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge(id_a, 'b', { condition: 'on_job_success' })],
  };
  const { plan } = convertRun(run as Run);
  const [job] = plan.jobs;

  t.truthy(job.next?.b);
  t.is(job.next.b.condition, conditions.on_job_success(id_a));

  // Check that this is valid js
  t.true(testEdgeCondition(job.next.b.condition, {}));
});

test('convert edge condition always', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    jobs: [createNode({ id: 'a' }), createNode({ id: 'b' })],
    triggers: [],
    edges: [createEdge('a', 'b', { condition: 'always' })],
  };
  const { plan } = convertRun(run as Run);

  const [job] = plan.jobs;

  t.false(job.next.b.hasOwnProperty('condition'));
});

test('convert random options', (t) => {
  const run: Partial<Run> = {
    id: 'w',
    options: {
      a: 1,
      b: 2,
      c: 3,
    },
  };
  const { options } = convertRun(run as Run);

  t.deepEqual(options, { a: 1, b: 2, c: 3 });
});
