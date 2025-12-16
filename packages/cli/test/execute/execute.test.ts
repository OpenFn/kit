// bunch of unit tests on the execute function itself
// so far this is only done in commands.test.ts, which has the cli overhead
// I don't want any io or adaptor tests here, really just looking for the actual execute flow
import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import fs from 'node:fs/promises';
import { ExecuteOptions } from '../../src/execute/command';
import handler from '../../src/execute/handler';
import { mockFs, resetMockFs } from '../util';

// Why is this logging everywhere?
const logger = createMockLogger(undefined, { level: 'debug' });

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
    // goes and creates a real logger and passes it to the runtime, which
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
    expressionPath: '/job.js',
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
    expressionPath: '/job.js',
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

test.serial(
  'run a workflow with errors and positions with anonymous steps',
  async (t) => {
    const workflow = {
      workflow: {
        steps: [
          {
            expression: `${fn}fn((state) => state.x.length)`,
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

    t.truthy(result.errors);
    const err = result.errors['job-1'];
    t.regex(err.message, /typeerror: cannot read properties of undefined/i);
    t.is(err.pos.line, 2);
    t.is(err.pos.column, 23);
  }
);

test.serial.only(
  "run a workflow with errors and positions with id'd steps",
  async (t) => {
    const workflow = {
      workflow: {
        steps: [
          {
            id: 'x',
            expression: `${fn}fn((state) => state.x.length)`,
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
    t.truthy(result.errors);
    console.log(result.errors);
    t.regex(
      result.errors.x.message,
      /typeerror: cannot read properties of undefined/i
    );
    t.is(result.errors.x.pos.line, 2);
    t.is(result.errors.x.pos.column, 23);
  }
);

test.serial(
  'run a workflow with errors and positions and named steps',
  async (t) => {
    const workflow = {
      workflow: {
        steps: [
          {
            id: 'x',
            name: 'My Step',
            expression: `${fn}fn((state) => state.x.length)`,
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
    t.truthy(result.errors);
    t.regex(
      result.errors.x.message,
      /typeerror: cannot read properties of undefined/i
    );
    t.is(result.errors.x.pos.line, 2);
    t.is(result.errors.x.pos.column, 23);
  }
);

test.serial('run a workflow with cached steps', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: `${fn}fn((state) => ({ a: true }))`,
          next: { b: true },
        },
        {
          id: 'b',
          expression: `${fn}fn((state) => ({ ...state, b: true }))`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
    '/.cli-cache/workflow/': {},
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    cacheSteps: true,
  };
  const result = await handler(options, logger);
  t.is(result.a, true);
  t.is(result.b, true);

  const cache_a = await fs.readFile('/.cli-cache/workflow/a.json', 'utf8');
  t.deepEqual(JSON.parse(cache_a), { a: true });

  const cache_b = await fs.readFile('/.cli-cache/workflow/b.json', 'utf8');
  t.deepEqual(JSON.parse(cache_b), { a: true, b: true, data: {} });
});

test.serial('.cli-cache has a gitignore', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          expression: `${fn}fn((state) => ({ a: true }))`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
    '/.cli-cache/workflow/': {},
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    cacheSteps: true,
  };
  await handler(options, logger);

  const gitignore = await fs.readFile('/.cli-cache/.gitignore', 'utf8');
  t.is(gitignore, '*');
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

test.serial('run a workflow from --start', async (t) => {
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

test.serial('run a workflow from --start and cached state', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: `${fn}fn((state) => state)`,
          next: { b: true },
        },
        {
          id: 'b',
          expression: `${fn}fn((state) => state)`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
    '/.cli-cache/workflow/a.json': JSON.stringify({ x: 22 }),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    start: 'b',
  };
  const result = await handler(options, logger);
  t.is(result.x, 22);
});

test.serial('run a workflow from --only and cached state', async (t) => {
  const workflow = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: `${fn}fn((state) => ({ ...state, a: true }))`,
          next: { b: true },
        },
        {
          id: 'b',
          expression: `${fn}fn((state) => ({ ...state, b: true }))`,
          next: { c: true },
        },
        {
          id: 'c',
          expression: `${fn}fn((state) => ({ ...state, c: true }))`,
        },
      ],
    },
  };
  mockFs({
    '/workflow.json': JSON.stringify(workflow),
    '/.cli-cache/workflow/a.json': JSON.stringify({ x: 22 }),
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
    only: 'b',
  };
  const result = await handler(options, logger);
  t.deepEqual(result, {
    b: true,
    x: 22,
    data: {},
  });
});

// On node 22 this fails to load the adaptor because import()
// no longer works with mock fs
test.serial.skip('run a workflow with an adaptor (longform)', async (t) => {
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

// On node 22 this fails to load the adaptor because import()
// no longer works with mock fs
test.serial.skip('run a workflow with an adaptor (shortform)', async (t) => {
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
    expandAdaptors: true,
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
    expressionPath: '/job.js',
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
    expressionPath: '/job.js',
  };
  const result = await handler(options, logger);
  t.falsy(result);

  // Check that no error messages have been logged
  t.is(logger._history.length, 0);
});

test.serial('globals: use a global function in an operation', async (t) => {
  const workflow = {
    workflow: {
      globals: "export const prefixer = (w) => 'welcome '+w",
      steps: [
        {
          id: 'a',
          state: { data: { name: 'John' } },
          expression: `${fn}fn(state=> { state.data.new = prefixer(state.data.name); return state; })`,
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
  t.deepEqual(result.data, { name: 'John', new: 'welcome John' });
});

test.serial('globals: get global functions from a filePath', async (t) => {
  const workflow = {
    workflow: {
      globals: '/my-globals.js',
      steps: [
        {
          id: 'a',
          state: { data: { name: 'John' } },
          expression: `${fn}fn(state=> { state.data.new = suffixer(state.data.name); return state; })`,
        },
      ],
    },
  };

  mockFs({
    '/workflow.json': JSON.stringify(workflow),
    '/my-globals.js': `export const suffixer = (w) => w + " goodbye!"`,
  });

  const options = {
    ...defaultOptions,
    workflowPath: '/workflow.json',
  };
  const result = await handler(options, logger);
  t.deepEqual(result.data, { name: 'John', new: 'John goodbye!' });
});
