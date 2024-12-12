import { createMockLogger } from '@openfn/logger';
import test from 'ava';
import mock from 'mock-fs';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { writeFileSync } from 'node:fs';
import { cmd } from '../src/cli';
import commandParser from '../src/commands';
import type { Opts } from '../src/options';

const logger = createMockLogger('', { level: 'debug' });

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

const EXPR_EXPORT_42 = 'export default [() => ({ data: { count: 42 } })];';
const EXPR_TIMES_2 =
  'export default [(state) => { state.data.count = state.data.count * 2; return state; }];';
const EXPR_MOCK_ADAPTOR =
  'import { byTwo } from "times-two"; export default [byTwo];';
const EXPR_EXPORT_STATE =
  "export default [() => ({ configuration: {}, data: {}, foo: 'bar' })];";

type RunOptions = {
  expressionPath?: string;
  statePath?: string;
  outputPath?: string;
  state?: any;
  repoDir?: string;
  logger?: {
    log: (s: string) => void;
  };
  disableMock?: boolean;
  mockfs?: object;
};

// Helper function to mock a file system with particular paths and values,
// then run the CLI against it
async function run(command: string, job: string, options: RunOptions = {}) {
  // The command parser is consuming the openfn command wrongly all of a sudden
  // A good reason to move all these into integration tests tbh!
  command = command.replace(/^openfn /, '');

  const expressionPath = options.expressionPath || 'job.js';
  const statePath = options.statePath || 'state.json';
  const outputPath = options.outputPath || 'output.json';
  const state =
    JSON.stringify(options.state) || '{ "data": {}, "configuration": {} }';

  // Ensure that pnpm is not mocked out
  // This is needed to ensure that pnpm dependencies can be dynamically loaded
  // (for recast in particular)
  const pnpm = path.resolve('../../node_modules/.pnpm');
  const pkgPath = path.resolve('./package.json');

  // Mock the file system in-memory
  if (!options.disableMock) {
    mock({
      [expressionPath]: job,
      [statePath]: state,
      [outputPath]: '{}',
      [pnpm]: mock.load(pnpm, {}),
      // enable us to load test modules through the mock
      '/modules/': mock.load(path.resolve('test/__modules__/'), {}),
      '/repo/': mock.load(path.resolve('test/__repo__/'), {}),
      '/monorepo/': mock.load(path.resolve('test/__monorepo__/'), {}),
      //'node_modules': mock.load(path.resolve('node_modules/'), {}),
      [pkgPath]: mock.load(pkgPath),
      ...(options.mockfs ?? {}),
    });
  }

  const opts = cmd.parse(command) as Opts;
  // Override some options after the command has been parsed
  opts.path = expressionPath;
  opts.repoDir = options.repoDir;

  opts.log = { default: 'none' };
  opts.skipAdaptorValidation = true;

  await commandParser(opts, logger);

  try {
    // Try and load the result as json as a test convenience
    const result = await fs.readFile(outputPath, 'utf8');
    if (result) {
      return JSON.parse(result);
    }
  } catch (e) {
    // do nothing
  }
}

async function mockResources() {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'commands-'));
  execSync(`cp -r ${path.resolve('test')}/__*__  ${tmpdir}`);

  const generateJob = async (job: string) => {
    if (job) writeFileSync(path.join(tmpdir, '/job.js'), job);
  };

  const generateOutput = async (value: string) => {
    if (value) writeFileSync(path.join(tmpdir, '/output.json'), value);
  };

  const createNew = async (filename: string, content: string) => {
    const newPath = path.join(tmpdir, filename);
    writeFileSync(newPath, content);
    return newPath;
  };

  return {
    mockPath: tmpdir,
    modulesPath: path.join(tmpdir, '/__modules__'),
    monorepoPath: path.join(tmpdir, '/__monorepo__'),
    repoPath: path.join(tmpdir, '__repo__'),
    jobPath: path.join(tmpdir, '/job.js'),
    outputPath: path.join(tmpdir, '/output.json'),
    generateJob,
    generateOutput,
    createNew,
  };
}

let resMock: Awaited<ReturnType<typeof mockResources>>;

test.before(async () => {
  resMock = await mockResources();
});

test.after(async () => {
  execSync(`rm -rf ${resMock.mockPath}`);
});

test.serial('run an execution plan', async (t) => {
  const plan = {
    workflow: {
      steps: [
        {
          id: 'job1',
          state: { data: { x: 0 } },
          expression: 'export default [s => { s.data.x += 1; return s; } ]',
          next: { job2: true },
        },
        {
          id: 'job2',
          expression: 'export default [s => { s.data.x += 1; return s; } ]',
        },
      ],
    },
  };

  const options = {
    outputPath: 'output.json',
    expressionPath: 'wf.json', // just to fool the test
  };

  const result = await run('openfn wf.json', JSON.stringify(plan), options);
  t.assert(result.data.x === 2);
});

test.serial('run an execution plan with start', async (t) => {
  const state = JSON.stringify({ data: { x: 0 } });
  const plan = {
    workflow: {
      steps: [
        {
          id: 'a',
          expression: 'export default [s => { s.data.x += 1; return s; } ]',
          next: { b: true },
        },
        {
          id: 'b',
          expression: 'export default [s => { s.data.x += 1; return s; } ]',
        },
      ],
    },
  };

  const options = {
    outputPath: 'output.json',
    expressionPath: 'wf.json', // just to fool the test
  };

  const result = await run(
    `openfn wf.json -S ${state} --start b`,
    JSON.stringify(plan),
    options
  );

  t.assert(result.data.x === 1);
});

test.serial('print version information with version', async (t) => {
  await run('version', '');

  const last = logger._parse(logger._last);
  const message = last.message as string;
  t.assert(message.length > 1);
  t.regex(message, /Versions:/);
  t.regex(message, /node.js/);
});

test.serial('run test job with default state', async (t) => {
  await run('test', '');

  const { message } = logger._parse(logger._last);
  t.assert(message === 'Result: 42');
});

test.serial('run test job with custom state', async (t) => {
  const state = JSON.stringify({ data: { answer: 1 } });

  await run(`test -S ${state}`, '');
  const { message } = logger._parse(logger._last);
  t.assert(message === 'Result: 1');
});

test.serial('run a job with defaults: openfn job.js', async (t) => {
  const result = await run('openfn job.js', EXPR_EXPORT_42);
  t.assert(result.data.count === 42);
});

test.serial('run a job which does not return state', async (t) => {
  const result = await run('openfn job.js', 'export default [s => {}]');

  t.falsy(result);
});

test.serial('run a workflow', async (t) => {
  const workflow = {
    jobs: [
      {
        id: 'job1',
        state: { data: { x: 0 } },
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
        next: { job2: true },
      },
      {
        id: 'job2',
        expression: 'export default [s => { s.data.x += 1; return s; } ]',
      },
    ],
  };

  const options = {
    outputPath: 'output.json',
    expressionPath: 'wf.json', // just to fool the test
  };

  const result = await run('openfn wf.json', JSON.stringify(workflow), options);
  t.assert(result.data.x === 2);
});

test.serial('run a workflow with config as an object', async (t) => {
  const workflow = {
    jobs: [
      {
        state: { data: { x: 0 } },
        configuration: { y: 0 },
        expression:
          'export default [s => { s.data.y = s.configuration.y; return s}]',
      },
    ],
  };

  const options = {
    outputPath: 'output.json',
    expressionPath: 'wf.json', // just to fool the test
  };
  const result = await run('openfn wf.json', JSON.stringify(workflow), options);
  t.deepEqual(result, {
    data: { x: 0, y: 0 },
  });
});

test.serial('run a workflow with config as a path', async (t) => {
  const workflow = {
    jobs: [
      {
        state: { data: { x: 0 } },
        configuration: '/config.json',
        expression:
          'export default [s => { s.data.y = s.configuration.y; return s}]',
      },
    ],
  };

  const options = {
    outputPath: 'output.json',
    expressionPath: 'wf.json', // just to fool the test
    mockfs: {
      '/config.json': JSON.stringify({ y: 0 }),
    },
  };
  const result = await run('openfn wf.json', JSON.stringify(workflow), options);
  t.deepEqual(result, {
    data: { x: 0, y: 0 },
  });
});

// TODO: this fails because of how paths are resolved in the test harness
//      We'll move it to an integration test soon
test.serial.skip(
  'run a trivial job from a folder: openfn ~/openfn/jobs/the-question',
  async (t) => {
    const options = {
      // set up the file system
      expressionPath:
        '~/openfn/jobs/the-question/what-is-the-answer-to-life-the-universe-and-everything.js',
      outputPath: '~/openfn/jobs/the-question/output.json',
      statePath: '~/openfn/jobs/the-question/state.json',
    };

    const result = await run(
      'openfn ~/openfn/jobs/the-question',
      EXPR_EXPORT_42,
      options
    );
    t.assert(result === 42);

    const output = await fs.readFile(
      '~/openfn/jobs/the-question/output.json',
      'utf8'
    );
    t.assert(output === '42');
  }
);

test.serial(
  'output to file: openfn job.js --output-path=/tmp/my-output.json',
  async (t) => {
    const options = {
      outputPath: '/tmp/my-output.json',
    };
    const result = await run(
      'openfn job.js --output-path=/tmp/my-output.json',
      EXPR_EXPORT_42,
      options
    );
    t.is(result.data.count, 42);

    const output = await fs.readFile('/tmp/my-output.json', 'utf8');
    const outputJson = JSON.parse(output);
    t.is(outputJson.data.count, 42);
  }
);

test.serial(
  'output to file with alias: openfn job.js -o=/tmp/my-output.json',
  async (t) => {
    const options = {
      outputPath: '/tmp/my-output.json',
    };
    const result = await run(
      'openfn job.js -o /tmp/my-output.json',
      EXPR_EXPORT_42,
      options
    );
    t.is(result.data.count, 42);

    const output = await fs.readFile('/tmp/my-output.json', 'utf8');
    const outputJson = JSON.parse(output);
    t.is(outputJson.data.count, 42);
  }
);

test.serial(
  'output to file removing configuration: openfn job.js --output-path=/tmp/my-output.json',
  async (t) => {
    const options = {
      outputPath: '/tmp/my-output.json',
    };

    const result = await run(
      'openfn job.js --output-path=/tmp/my-output.json',
      EXPR_EXPORT_STATE,
      options
    );
    t.deepEqual(result, { data: {}, foo: 'bar' });

    const expectedFileContents = JSON.stringify(
      { data: {}, foo: 'bar' },
      null,
      2
    );
    const output = await fs.readFile('/tmp/my-output.json', 'utf8');
    t.assert(output === expectedFileContents);
  }
);

test.serial(
  'read state from file: openfn job.js --state-path=/tmp/my-state.json',
  async (t) => {
    const options = {
      statePath: '/tmp/my-state.json',
      state: { data: { count: 33 } },
    };
    const result = await run(
      'openfn job.js --state-path=/tmp/my-state.json',
      EXPR_TIMES_2,
      options
    );
    t.assert(result.data.count === 66);
  }
);

test.serial(
  'read state from file with alias: openfn job.js -s /tmp/my-state.json',
  async (t) => {
    const options = {
      statePath: '/tmp/my-state.json',
      state: { data: { count: 33 } },
    };
    const result = await run(
      'openfn job.js -s /tmp/my-state.json',
      EXPR_TIMES_2,
      options
    );
    t.assert(result.data.count === 66);
  }
);

test.serial(
  'read state from stdin: openfn job.js --state-stdin=<obj>',
  async (t) => {
    const state = JSON.stringify({ data: { count: 11 } });
    const result = await run(
      `openfn job.js --state-stdin=${state}`,
      EXPR_TIMES_2
    );
    t.assert(result.data.count === 22);
  }
);

test.serial(
  'read state from stdin with alias: openfn job.js -S <obj>',
  async (t) => {
    const state = JSON.stringify({ data: { count: 44 } });
    const result = await run(`openfn job.js -S ${state}`, EXPR_TIMES_2);
    t.assert(result.data.count === 88);
  }
);

test.serial(
  'override an adaptor: openfn --no-expand-adaptors -S <obj> --adaptor times-two=<path-to-module>',
  async (t) => {
    const state = JSON.stringify({ data: { count: 49.5 } });

    await resMock.generateJob(EXPR_MOCK_ADAPTOR);

    const result = await run(
      `openfn ${resMock.jobPath} --no-expand-adaptors -S ${state} --adaptor times-two=${resMock.modulesPath}/times-two`,
      '',
      { disableMock: true, outputPath: resMock.outputPath }
    );

    t.assert(result.data.count === 99);
  }
);

test.serial(
  'override adaptors: openfn --no-expand-adaptors -S <obj> --adaptors times-two=<path-to-module>',
  async (t) => {
    const state = JSON.stringify({ data: { count: 49.5 } });

    await resMock.generateJob(EXPR_MOCK_ADAPTOR);
    const result = await run(
      `openfn ${resMock.jobPath} --no-expand-adaptors -S ${state} --adaptors times-two=${resMock.modulesPath}/times-two`,
      '',
      { disableMock: true, outputPath: resMock.outputPath }
    );
    t.assert(result.data.count === 99);
  }
);

test.serial(
  'override adaptors: openfn --no-expand-adaptors -S <obj> -a times-two=<path-to-module>',
  async (t) => {
    const state = JSON.stringify({ data: { count: 49.5 } });

    // mock module with real filesystem
    await resMock.generateJob(EXPR_MOCK_ADAPTOR);
    const result = await run(
      `openfn ${resMock.jobPath} --no-expand-adaptors -S ${state} -a times-two=${resMock.modulesPath}/times-two`,
      '',
      { disableMock: true, outputPath: resMock.outputPath }
    );
    t.assert(result.data.count === 99);
  }
);

test.serial(
  'auto-import from test module with repoDir: openfn job.js -S <obj> -a times-two',
  async (t) => {
    const state = JSON.stringify({ data: { count: 11 } });
    const job = 'export default [byTwo]';
    await resMock.generateJob(job);
    const result = await run(
      `openfn ${resMock.jobPath} --no-expand-adaptors -S ${state} -a times-two  --no-autoinstall`,
      '',
      {
        disableMock: true,
        repoDir: resMock.repoPath,
        outputPath: resMock.outputPath,
      }
    );
    t.assert(result.data.count === 22);
  }
);

test.serial(
  'auto-import from test module with path: openfn job.js -S <obj> -a times-two',
  async (t) => {
    const state = JSON.stringify({ data: { count: 22 } });
    const job = 'export default [byTwo]';
    await resMock.generateJob(job);
    const result = await run(
      `openfn ${resMock.jobPath} -S ${state} -a times-two=${resMock.modulesPath}/times-two`,
      '',
      { disableMock: true, outputPath: resMock.outputPath }
    );
    t.assert(result.data.count === 44);
  }
);

test.serial(
  'auto-import from language-common (job): openfn job.js -a @openfn/language-common@0.0.1',
  async (t) => {
    const job = 'fn((state) => { state.data.done = true; return state; });';
    await resMock.generateJob(job);
    const result = await run(
      `openfn ${resMock.jobPath} -a @openfn/language-common@0.0.1`,
      '',
      {
        disableMock: true,
        repoDir: resMock.repoPath,
        outputPath: resMock.outputPath,
      }
    );
    t.true(result.data?.done);
  }
);

test.serial(
  'run a workflow using language-common: openfn wf.json',
  async (t) => {
    const workflow = {
      jobs: [
        {
          adaptor: '@openfn/language-common@0.0.1',
          expression:
            'fn((state) => { state.data.done = true; return state; });',
        },
      ],
    };

    const wfPath = await resMock.createNew(
      '/wf.json',
      JSON.stringify(workflow)
    );
    const options = {
      disableMock: true,
      outputPath: resMock.outputPath,
      expressionPath: wfPath,
      repoDir: resMock.repoPath,
    };

    await resMock.generateJob(JSON.stringify(workflow));
    const result = await run(`openfn ${wfPath}`, '', options);
    t.true(result.data?.done);
  }
);

test.serial(
  'use execute from language-postgres: openfn job.js -a @openfn/language-postgres',
  async (t) => {
    const job =
      'alterState((state) => { /* function isn\t actually called by the mock adaptor */ throw new Error("fake adaptor") });';

    await resMock.generateJob(job);
    const result = await run(
      `openfn ${resMock.jobPath} -a @openfn/language-postgres --no-autoinstall`,
      '',
      {
        disableMock: true,
        repoDir: resMock.repoPath,
        outputPath: resMock.outputPath,
      }
    );
    t.assert(result === 'execute called!');
  }
);

test.serial(
  'load an adaptor from the monorepo env var: openfn job.js -m -a common',
  async (t) => {
    process.env.OPENFN_ADAPTORS_REPO = resMock.monorepoPath;
    const job = 'export default [alterState(() => 39)]';
    await resMock.generateJob(job);
    const result = await run(`${resMock.jobPath} -m -a common`, '', {
      disableMock: true,
      outputPath: resMock.outputPath,
    });
    t.assert(result === 39);
    delete process.env.OPENFN_ADAPTORS_REPO;
  }
);

// TODO: dang, this doesn't work
// I need to inspect the output of the job logger, but I can't really access it
// because execute creates its own job logger and right now I have no means of
// controlling that from here
// I'll have to leave this as an integration test for now
test.serial.skip('sanitize output', async (t) => {
  const job = 'export default [() => {console.log({}); return 22}]';

  const result = await run('job.js -a common --sanitize=obfuscate', job);
  t.is(result, 22);

  // console.log(logger._history);
  const output = logger._find('debug', /$([object])^/);
  // console.log(output);
  t.truthy(output);
  t.is(output?.namespace, 'job');
});

test.serial(
  'load a workflow adaptor from the monorepo: openfn workflow.json -m',
  async (t) => {
    process.env.OPENFN_ADAPTORS_REPO = '/monorepo/';
    const workflow = JSON.stringify({
      jobs: [
        {
          adaptor: 'common',
          state: { data: { done: true } },
          expression: 'alterState(s => s)',
        },
      ],
    });

    const result = await run('workflow.json -m', workflow, {
      expressionPath: 'workflow.json',
    });
    t.true(result.data.done);
    delete process.env.OPENFN_ADAPTORS_REPO;
  }
);

test.serial('compile a job: openfn compile job.js to stdout', async (t) => {
  const options = {};
  await run('compile job.js', 'fn(42);', options);

  const { message } = logger._parse(logger._last);
  t.regex(message, /export default/);
});

test.serial('compile a job: openfn compile job.js to file', async (t) => {
  const options = {
    outputPath: 'out.js',
  };
  await run('compile job.js -o out.js', 'fn(42);', options);

  const output = await fs.readFile('out.js', 'utf8');
  t.is(output, 'export default [fn(42)];');
});

test.serial('compile a workflow: openfn compile wf.json to file', async (t) => {
  const options = {
    outputPath: 'out.json',
    expressionPath: 'wf.json', // just to fool the test
  };

  const wf = JSON.stringify({
    start: 'a',
    jobs: [{ expression: 'x()' }],
  });
  await run('compile wf.json -o out.json', wf, options);

  const output = await fs.readFile('out.json', 'utf8');
  const result = JSON.parse(output);
  t.truthy(result);
  t.is(result.workflow.steps[0].expression, 'export default [x()];');
});

test.serial('docs should print documentation with full names', async (t) => {
  mock({
    '/repo/docs/@openfn/language-common@1.0.0.json': JSON.stringify({
      name: 'test',
      functions: [
        {
          name: 'fn',
          parameters: [],
          examples: [],
        },
      ],
    }),
  });

  const opts = cmd.parse('docs @openfn/language-common@1.0.0 fn') as Opts;
  opts.repoDir = '/repo';

  await commandParser(opts, logger);
  const docs = logger._parse(logger._history[2]).message as string;

  // match the signature
  t.regex(docs, /\#\# fn\(\)/);
  // Match usage examples
  t.regex(docs, /\#\#\# Usage Examples/);
  t.regex(
    docs,
    /https:\/\/docs.openfn.org\/adaptors\/packages\/common-docs#fn/
  );
});

test.serial('docs adaptor should list operations', async (t) => {
  const pkgPath = path.resolve('./package.json');
  mock({
    [pkgPath]: mock.load(pkgPath),
    '/repo/docs/@openfn/language-common@1.0.0.json': JSON.stringify({
      name: 'test',
      version: '1.0.0',
      functions: [
        {
          name: 'fn',
          parameters: [{ name: 'a' }, { name: 'b' }],
          examples: [],
        },
      ],
    }),
  });

  const opts = cmd.parse('docs common@1.0.0') as Opts;
  opts.repoDir = '/repo';

  await commandParser(opts, logger);

  const docs = logger._parse(logger._history[3]).message as string;
  t.notRegex(docs, /\[object Object\]/);
  t.notRegex(docs, /\#\#\# Usage Examples/);
  t.regex(docs, /fn.+\(a, b\)/);
});

test.serial(
  'docs adaptor + operation should print documention with shorthand names',
  async (t) => {
    mock({
      '/repo/docs/@openfn/language-common@1.0.0.json': JSON.stringify({
        name: 'test',
        functions: [
          {
            name: 'fn',
            parameters: [],
            examples: [],
          },
        ],
      }),
    });

    const opts = cmd.parse('docs common@1.0.0 fn') as Opts;
    opts.repoDir = '/repo';

    await commandParser(opts, logger);
    const docs = logger._parse(logger._history[2]).message as string;
    // match the signature
    t.regex(docs, /\#\# fn\(\)/);
    // Match usage examples
    t.regex(docs, /\#\#\# Usage Examples/);
    t.notRegex(docs, /\[object Object\]/);
    t.regex(
      docs,
      /https:\/\/docs.openfn.org\/adaptors\/packages\/common-docs#fn/
    );
  }
);
