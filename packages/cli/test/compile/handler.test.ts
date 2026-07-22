import test from 'ava';
import fs from 'node:fs/promises';
import { createMockLogger } from '@openfn/logger';

import compileHandler from '../../src/compile/handler';
import { CompileOptions } from '../../src/compile/command';
import { mockFs, resetMockFs } from '../util';

const logger = createMockLogger();

test.afterEach(() => {
  logger._reset();
});

test.after(resetMockFs);

test.serial('compile an expression file to stdout', async (t) => {
  mockFs({
    '/job.js': 'x();',
  });

  const options = { expressionPath: '/job.js' } as CompileOptions;
  await compileHandler(options, logger);

  t.truthy(logger._find('success', /export default \[x\(\)\];/));
});

test.serial('compile an expression file to outputPath', async (t) => {
  mockFs({
    '/job.js': 'x();',
  });

  const options = {
    expressionPath: '/job.js',
    outputPath: '/out/job.js',
  } as CompileOptions;
  await compileHandler(options, logger);

  const code = await fs.readFile('/out/job.js', 'utf-8');
  t.is(code, 'export default [x()];');
});

test.serial('compile a workflow file to outputPath', async (t) => {
  mockFs({
    '/wf.json': JSON.stringify({
      workflow: {
        steps: [{ id: 'a', expression: 'x()' }],
      },
    }),
  });

  const options = {
    planPath: '/wf.json',
    outputPath: '/out/wf.json',
  } as CompileOptions;
  await compileHandler(options, logger);

  const plan = JSON.parse(await fs.readFile('/out/wf.json', 'utf-8'));
  t.is(plan.workflow.steps[0].expression, 'export default [x()];');
});

test.serial(
  'compile the checked-out project when no path is given',
  async (t) => {
    mockFs({
      '/proj/openfn.yaml': `
dirs:
  workflows: /proj/workflows
`,
      '/proj/workflows/wf1/wf1.yaml': `
id: wf1
steps:
  - id: step-a
    expression: "x();"
`,
    });

    const options = { workspace: '/proj' } as CompileOptions;
    await compileHandler(options, logger);

    const code = await fs.readFile('/proj/dist/wf1/step-a.mjs', 'utf-8');
    t.true(code.includes('export default [x()]'));
  }
);

test.serial('throw if the expression file does not exist', async (t) => {
  mockFs({});

  const options = { expressionPath: '/missing.js' } as CompileOptions;

  await t.throwsAsync(() => compileHandler(options, logger), {
    message: /failed to compile/i,
  });
});
