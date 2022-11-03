import test from 'ava';
import mock from 'mock-fs';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createMockLogger } from '@openfn/logger';

import { cmd } from '../src/cli';
import commandParser, { Opts } from '../src/commands';

const logger = createMockLogger();

test.afterEach(() => {
  mock.restore();
  logger._reset();
});

const JOB_EXPORT_42 = 'export default [() => 42];';
const JOB_TIMES_2 = 'export default [(state) => state * 2];';
const JOB_MOCK_ADAPTOR =
  'import { byTwo } from "times-two"; export default [byTwo];';

type RunOptions = {
  jobPath?: string;
  statePath?: string;
  outputPath?: string;
  state?: any;
  modulesHome?: string;
  logger?: {
    log: (s: string) => void;
  };
  disableMock?: boolean;
};

// Helper function to mock a file system with particular paths and values,
// then run the CLI against it
async function run(command: string, job: string, options: RunOptions = {}) {
  const jobPath = options.jobPath || 'test-job.js';
  const statePath = options.statePath || 'state.json';
  const outputPath = options.outputPath || 'output.json';
  const state =
    JSON.stringify(options.state) || '{ "data": {}, "configuration": {} }';

  // Ensure that pnpm is not mocked out
  // This is needed to ensure that pnpm dependencies can be dynamically loaded
  // (for recast in particular)
  const pnpm = path.resolve('../../node_modules/.pnpm');

  // Mock the file system in-memory
  if (!options.disableMock) {
    mock({
      [jobPath]: job,
      [statePath]: state,
      [outputPath]: '{}',
      [pnpm]: mock.load(pnpm, {}),
      // enable us to load test modules through the mock
      '/modules/': mock.load(path.resolve('test/__modules__/'), {}),
      '/repo/': mock.load(path.resolve('test/__repo__/'), {}),
      //'node_modules': mock.load(path.resolve('node_modules/'), {}),
    });
  }

  const opts = cmd.parse(command) as Opts;
  opts.modulesHome = options.modulesHome;

  opts.log = ['none'];

  await commandParser(jobPath, opts, logger);

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

// Skipped because we're relying on yargs.version
test.serial.skip('print version information with -v', async (t) => {
  const out: string[] = [];
  const logger = {
    log: (m: string) => out.push(m),
  };
  await run('openfn -v', '', { logger, disableMock: true });
  t.assert(out.length > 0);
});

// Skipped because we're relying on yargs.version
test.serial.skip('print version information with --version', async (t) => {
  const out: string[] = [];
  const logger = {
    log: (m: string) => out.push(m),
  };
  await run('openfn --version', '', { logger, disableMock: true });
  t.assert(out.length > 0);
});

test.serial('run test job with default state', async (t) => {
  await run('test', '', { logger });
  const { message } = logger._parse(logger._last);
  t.assert(message === 'Result: 42');
});

test.serial('run test job with custom state', async (t) => {
  await run('test -S 1', '', { logger });
  const { message } = logger._parse(logger._last);
  t.assert(message === 'Result: 2');
});

test.serial('run a job with defaults: openfn job.js', async (t) => {
  const result = await run('openfn job.js', JOB_EXPORT_42);
  t.assert(result === 42);
});

test.serial(
  'run a trivial job from a folder: openfn ~/openfn/jobs/the-question',
  async (t) => {
    const options = {
      // set up the file system
      jobPath:
        '~/openfn/jobs/the-question/what-is-the-answer-to-life-the-universe-and-everything.js',
      outputPath: '~/openfn/jobs/the-question/output.json',
      statePath: '~/openfn/jobs/the-question/state.json',
    };

    const result = await run(
      'openfn ~/openfn/jobs/the-question',
      JOB_EXPORT_42,
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
      JOB_EXPORT_42,
      options
    );
    t.assert(result === 42);

    const output = await fs.readFile('/tmp/my-output.json', 'utf8');
    t.assert(output === '42');
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
      JOB_EXPORT_42,
      options
    );
    t.assert(result === 42);

    const output = await fs.readFile('/tmp/my-output.json', 'utf8');
    t.assert(output === '42');
  }
);

test.serial(
  'read state from file: openfn job.js --state-path=/tmp/my-state.json',
  async (t) => {
    const options = {
      statePath: '/tmp/my-state.json',
      state: '33',
    };
    const result = await run(
      'openfn job.js --state-path=/tmp/my-state.json',
      JOB_TIMES_2,
      options
    );
    t.assert(result === 66);
  }
);

test.serial(
  'read state from file with alias: openfn job.js -s /tmp/my-state.json',
  async (t) => {
    const options = {
      statePath: '/tmp/my-state.json',
      state: '33',
    };
    const result = await run(
      'openfn job.js -s /tmp/my-state.json',
      JOB_TIMES_2,
      options
    );
    t.assert(result === 66);
  }
);

test.serial(
  'read state from stdin: openfn job.js --state-stdin=11',
  async (t) => {
    const result = await run('openfn job.js --state-stdin=11', JOB_TIMES_2);
    t.assert(result === 22);
  }
);

test.serial(
  'read state from stdin with alias: openfn job.js -S 44',
  async (t) => {
    const result = await run('openfn job.js -S 44', JOB_TIMES_2);
    t.assert(result === 88);
  }
);

test.serial(
  'override an adaptor: openfn -S 49.5 --adaptor times-two=/modules/times-two',
  async (t) => {
    const result = await run(
      'openfn -S 49.5 --adaptor times-two=/modules/times-two',
      JOB_MOCK_ADAPTOR
    );
    t.assert(result === 99);
  }
);

test.serial(
  'override adaptors: openfn -S 49.5 --adaptors times-two=/modules/times-two',
  async (t) => {
    const result = await run(
      'openfn -S 49.5 --adaptors times-two=/modules/times-two',
      JOB_MOCK_ADAPTOR
    );
    t.assert(result === 99);
  }
);

test.serial(
  'override adaptors: openfn -S 49.5 -a times-two=/modules/times-two',
  async (t) => {
    const result = await run(
      'openfn -S 49.5 -a times-two=/modules/times-two',
      JOB_MOCK_ADAPTOR
    );
    t.assert(result === 99);
  }
);

test.serial(
  'auto-import from test module with modulesHome: openfn job.js -S 11 -a times-two',
  async (t) => {
    const job = 'export default [byTwo]';
    const result = await run('openfn -S 11 -a times-two', job, {
      modulesHome: '/repo',
    });
    t.assert(result === 22);
  }
);

test.serial(
  'auto-import from test module with path: openfn job.js -S 11 -a times-two',
  async (t) => {
    const job = 'export default [byTwo]';
    const result = await run(
      'openfn -S 22 -a times-two=/modules/times-two',
      job
    );
    t.assert(result === 44);
  }
);

test.serial(
  'auto-import from language-common: openfn job.js -a @openfn/language-common',
  async (t) => {
    const job = 'fn((state) => { state.data.done = true; return state; });';
    const result = await run('openfn -a @openfn/language-common', job, {
      modulesHome: '/repo',
    });
    t.truthy(result.data?.done);
  }
);

test.serial(
  'use execute from language-postgres: openfn job.js -a @openfn/language-postgres',
  async (t) => {
    const job =
      'fn((state) => { /* function isn\t actually called by the mock adaptor */ throw new Error("fake adaptor") });';
    const result = await run('openfn -a @openfn/language-postgres', job, {
      modulesHome: '/repo',
    });
    t.assert(result === 'execute called!');
  }
);

test.serial('compile a job: openfn compile job.js', async (t) => {
  const options = {
    outputPath: 'output.js',
  };
  await run('compile job.js', 'fn(42);', options);

  const output = await fs.readFile('output.js', 'utf8');
  t.assert(output === 'export default [fn(42)];');
});

// TODO - need to work out a way to test agaist stdout
// should return to stdout
// should log stuff to console
// should not log if silent is true

// TODO how would we test skip compilation and no validation? I guess we pass illegal code?
