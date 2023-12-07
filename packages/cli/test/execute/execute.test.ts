// bunch of unit tests on the execute function itself
// so far this is only done in commands.test.ts, which has the cli overhead
// I don't want any io or adaptor tests here, really just looking for the actual execute flow
import mock from 'mock-fs';
import path from 'node:path';
import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import { ExecuteOptions } from '../../src/execute/command';
import handler from '../../src/execute/handler';

// Why is this logging everywhere?
const logger = createMockLogger(undefined, { level: 'none' });

// These options are designed to minimise i/o
// and ensure type safely
const defaultOptions = {
  adaptors: [],
  outputStdOut: true,
  compile: true,
  repoDir: '/repo',
  path: '.',
  log: {
    // TODO if I pass a mock logger into the handler, the handler then
    // goes and creates a real logger and passes it to the runtinme, which
    // causes all sorts of logging
    // Why isn't that affecting other tests?
    // Why do I need this special handling here?
    default: 'none',
  } as any, // TODO some weird typing here
  logJson: true,
} as Partial<ExecuteOptions>;

const fn = `const fn = (fn) => (s) => fn(s);
`;

test.before(() => {
  const pnpm = path.resolve('../../node_modules/.pnpm');
  mock({
    '/repo/': mock.load(path.resolve('test/__repo__/'), {}),
    [pnpm]: mock.load(pnpm, {}),
    '/exp.js': `${fn}fn(() => ({ data: 42 }));`,
    '/config.json': JSON.stringify({ id: 'x' }),
    '/workflow.json': JSON.stringify({
      jobs: [
        {
          expression: `${fn}fn(() => ({ data: { count: 42 } }));`,
        },
      ],
    }),
  });
});

test.after(() => mock.restore());

test('run a job', async (t) => {
  const job = `${fn}fn(() => ({ data: 42 }));`;
  const options = {
    ...defaultOptions,
    job,
  };
  const result = await handler(options, logger);
  t.is(result.data, 42);
});

test('run a job with initial state', async (t) => {
  const job = `${fn}fn((state) => state);`;
  const options = {
    ...defaultOptions,
    job,
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 10);
});

test('run a workflow from a path', async (t) => {
  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 42);
});

test('run a workflow', async (t) => {
  const workflow = {
    start: 'a',
    jobs: [
      {
        id: 'a',
        expression: `${fn}fn(() => ({ data: { count: 42 } }));`,
        next: { b: true },
      },
      {
        id: 'b',
        expression: `${fn}fn((state) => { state.data.count = state.data.count * 2; return state; });`,
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 84);
});

test('run a workflow with state', async (t) => {
  const workflow = {
    start: 'a',
    jobs: [
      {
        id: 'a',
        state: { data: { count: 1 } },
        expression: `${fn}fn((state) => { state.data.count += 1; return state;});`,
        next: { b: true },
      },
      {
        id: 'b',
        state: { data: { diff: 2 } },
        expression: `${fn}fn((state) => { state.data.count += state.data.diff; return state; });`,
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 4);
});

test('run a workflow with initial state', async (t) => {
  const workflow = {
    start: 'a',
    jobs: [
      {
        id: 'a',
        expression: `${fn}fn((state) => { state.data.count += 1; return state;});`,
        next: { b: true },
      },
      {
        id: 'b',
        expression: `${fn}fn((state) => { state.data.count += 1; return state; });`,
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 12);
});

test('run a workflow with an expression as a path', async (t) => {
  const workflow = {
    jobs: [
      {
        expression: '/exp.js',
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
  };
  const result = await handler(options, logger);
  t.is(result.data, 42);
});

test('run a workflow with config as a path', async (t) => {
  const workflow = {
    jobs: [
      {
        configuration: '/config.json',
        expression: `${fn}fn((state) => { state.cfg = state.configuration; return state; })`,
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
  };
  const result = await handler(options, logger);
  t.is(result.cfg.id, 'x');
});

test('run a workflow from a start node', async (t) => {
  const workflow = {
    jobs: [
      {
        id: 'a',
        expression: `${fn}fn((state) => ({ data: { result: 'a' }}))`,
      },
      {
        id: 'b',
        expression: `${fn}fn((state) => ({ data: { result: 'b' }}))`,
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
    start: 'b',
  };
  const result = await handler(options, logger);
  t.is(result.data.result, 'b');
});

test('run a workflow with an adaptor (longform)', async (t) => {
  const workflow = {
    jobs: [
      {
        adaptor: '@openfn/language-common',
        expression: `fn((state) => state);`,
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 10);
});

test('run a workflow with an adaptor (shortform)', async (t) => {
  const workflow = {
    jobs: [
      {
        adaptor: 'common',
        expression: `fn((state) => state);`,
      },
    ],
  };
  const options = {
    ...defaultOptions,
    workflow,
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 10);
});

test('run a job without compilation', async (t) => {
  const job = `export default [() => ({ data: { count: 42 } })]`;
  const options = {
    ...defaultOptions,
    compile: false,
    job,
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 42);
});

test('run a job which does not return state', async (t) => {
  const job = `${fn}fn(() => {});`;
  const options = {
    ...defaultOptions,
    job,
  };
  const result = await handler(options, logger);
  t.falsy(result);

  // Check that no error messages have been logged
  t.is(logger._history.length, 0);
});
