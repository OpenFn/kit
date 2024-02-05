// bunch of unit tests on the execute function itself
// so far this is only done in commands.test.ts, which has the cli overhead
// I don't want any io or adaptor tests here, really just looking for the actual execute flow
import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import { ExecuteOptions } from '../../src/execute/command';
import handler from '../../src/execute/handler';
import { mockFs, resetMockFs } from '../util';

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

test.after(resetMockFs);

test.serial('run a simple job', async (t) => {
  const job = `${fn}fn(() => ({ data: 42 }));`;

  mockFs({
    '/job.js': job,
  });

  const options = {
    ...defaultOptions,
    jobPath: '/job.js',
  };

  const result = await handler(options, logger);
  t.is(result.data, 42);
});

test.serial('run a job with initial state', async (t) => {
  const job = `${fn}fn((state) => state);`;
  mockFs({
    '/job.js': job,
  });

  const options = {
    ...defaultOptions,
    jobPath: '/job.js',
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };

  const result = await handler(options, logger);
  t.is(result.data.count, 10);
});

test.serial('run a workflow', async (t) => {
  const workflow = {
    options: {
      start: 'a',
    },
    workflow: {
      steps: [
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
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 84);
});

test.serial('run a workflow with state', async (t) => {
  const workflow = {
    workflow: {
      steps: [
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
    },
  };

  mockFs({
    '/workflow.json': JSON.stringify(workflow),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 4);
});

test.serial('run a workflow with initial state from stdin', async (t) => {
  const workflow = {
    workflow: {
      steps: [
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
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 12);
});

test.serial('run a workflow with an expression as a path', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          expression: '/exp.js',
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
    '/exp.js': `${fn}fn(() => ({ data: 42 }));`,
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
  };
  const result = await handler(options, logger);
  t.is(result.data, 42);
});

test.serial('run a workflow with config as a path', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          configuration: '/config.json',
          expression: `${fn}fn((state) => { state.cfg = state.configuration; return state; })`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
    '/config.json': JSON.stringify({ id: 'x' }),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
  };
  const result = await handler(options, logger);
  t.is(result.cfg.id, 'x');
});

test.serial('run a workflow from a start node', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: `${fn}fn((state) => ({ data: { result: 'a' }}))`,
        },
        {
          id: 'b',
          expression: `${fn}fn((state) => ({ data: { result: 'b' }}))`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    start: 'b',
  };
  const result = await handler(options, logger);
  t.is(result.data.result, 'b');
});

test.serial('run a workflow with an adaptor (longform)', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          adaptor: '@openfn/language-common',
          expression: `fn((state) => state);`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 10);
});

test.serial('run a workflow with an adaptor (shortform)', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          adaptor: 'common',
          expression: `fn((state) => state);`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    stateStdin: JSON.stringify({ data: { count: 10 } }),
  };
  const result = await handler(options, logger);
  t.is(result.data.count, 10);
});

test.serial('run a job without compilation', async (t) => {
  const job = `export default [() => ({ data: { count: 42 } })]`;
  mockFs({
    '/job.js': job,
  });

  const options = {
    ...defaultOptions,
    compile: false,
    jobPath: '/job.js',
  };

  const result = await handler(options, logger);
  t.is(result.data.count, 42);
});

test.serial('run a job which does not return state', async (t) => {
  const job = `${fn}fn(() => {});`;
  mockFs({
    '/job.js': job,
  });

  const options = {
    ...defaultOptions,
    jobPath: '/job.js',
  };
  const result = await handler(options, logger);
  t.falsy(result);

  // Check that no error messages have been logged
  t.is(logger._history.length, 0);
});
