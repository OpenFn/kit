/*
 * New entry point for loading up the input/execution plan
   Note that htere's a lot of complexity from load input that I need to deal with here :(
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { isPath } from '@openfn/compiler';

import abort from './abort';
import expandAdaptors from './expand-adaptors';
import mapAdaptorsToMonorepo from './map-adaptors-to-monorepo';
import type { ExecutionPlan, Job, WorkflowOptions } from '@openfn/lexicon';
import type { Opts } from '../options';
import type { Logger } from './logger';
import type { OldCLIWorkflow } from '../types';

const loadPlan = async (
  options: Pick<
    Opts,
    | 'jobPath'
    | 'planPath'
    | 'workflowPath'
    | 'adaptors'
    | 'baseDir'
    | 'expandAdaptors'
  >,
  logger: Logger
): Promise<ExecutionPlan> => {
  const { workflowPath, planPath, jobPath } = options;

  if (jobPath) {
    return loadExpression(options, logger);
  }

  const jsonPath = planPath || workflowPath;

  if (!options.baseDir) {
    options.baseDir = path.dirname(jsonPath!);
  }

  // TODO if neither jobPath, planPath or workflowPath is set... what happens?
  // I think the CLI will exit before we even get here
  const json = await loadJson(jsonPath!, logger);
  if (json.workflow) {
    return loadXPlan(json, options, logger);
  } else {
    return loadOldWorkflow(json, options, logger);
  }
};

export default loadPlan;

// TODO this is way over simplified :(
// see load-input
const loadJson = async (workflowPath: string, logger: Logger): Promise<any> => {
  let text: string;

  try {
    text = await fs.readFile(workflowPath, 'utf8');
  } catch (e) {
    return abort(
      logger,
      'Workflow not found',
      undefined,
      `Failed to load a workflow from ${workflowPath}`
    );
  }

  let json: object;
  try {
    json = JSON.parse(text);
  } catch (e: any) {
    return abort(
      logger,
      'Invalid JSON in workflow',
      e,
      `Check the syntax of the JSON at ${workflowPath}`
    );
  }

  return json;
};

const maybeAssign = (a: any, b: any, keys: Array<keyof WorkflowOptions>) => {
  keys.forEach((key) => {
    if (a.hasOwnProperty(key)) {
      b[key] = a[key];
    }
  });
};

const loadExpression = async (
  options: Pick<Opts, 'jobPath' | 'adaptors' | 'monorepoPath'>,
  logger: Logger
): Promise<ExecutionPlan> => {
  const jobPath = options.jobPath!;

  logger.debug(`Loading expression from ${jobPath}`);
  const expression = await fs.readFile(jobPath, 'utf8');
  const name = path.parse(jobPath).name;

  const step: Job = { expression };

  // The adaptor should have been expanded nicely already, so we don't need intervene here
  if (options.adaptors) {
    const [adaptor] = options.adaptors;
    if (adaptor) {
      step.adaptor = adaptor;
    }
  }

  const wfOptions: WorkflowOptions = {};
  // TODO support state props to remove?
  maybeAssign(options, wfOptions, ['timeout']);

  const plan: ExecutionPlan = {
    workflow: {
      name,
      steps: [step],
    },
    options: wfOptions,
  };
  // call loadXPlan now so that any options can be written
  return loadXPlan(plan, options, logger);
};

const loadOldWorkflow = async (
  workflow: OldCLIWorkflow,
  options: Pick<Opts, 'workflowPath' | 'monorepoPath'>,
  logger: Logger
) => {
  const plan: ExecutionPlan = {
    workflow: {
      steps: workflow.jobs,
    },
    options: {
      start: workflow.start,
    },
  };

  if (workflow.id) {
    plan.id = workflow.id;
  }

  try {
    const name = path.parse(options.workflowPath!).name;
    if (name) {
      plan.workflow.name = name;
    }
  } catch (e) {
    // do nothing
  }

  // call loadXPlan now so that any options can be written
  const final = await loadXPlan(plan, options, logger);

  // TODO this can be nicer
  logger.warn('converted old workflow into execution plan');
  logger.warn(final);

  return final;
};

const fetchFile = async (
  jobId: string,
  rootDir: string = '',
  filePath: string,
  log: Logger
) => {
  try {
    // Special handling for ~ feels like a necessary evil
    const fullPath = filePath.startsWith('~')
      ? filePath
      : path.resolve(rootDir, filePath);
    const result = await fs.readFile(fullPath, 'utf8');
    return result;
  } catch (e) {
    abort(
      log,
      `File not found for job ${jobId}: ${filePath}`,
      undefined,
      `This workflow references a file which cannot be found at ${filePath}\n\nPaths inside the workflow are relative to the workflow.json`
    );

    // should never get here
    return '.';
  }
};

// TODO this is currently untested in load-plan
// (but covered a bit in execute tests)
const importExpressions = async (
  plan: ExecutionPlan,
  rootDir: string,
  log: Logger
) => {
  let idx = 0;
  for (const step of plan.workflow.steps) {
    const job = step as Job;
    if (!job.expression) {
      continue;
    }
    idx += 1;
    const expressionStr =
      typeof job.expression === 'string' && job.expression?.trim();
    const configurationStr =
      typeof job.configuration === 'string' && job.configuration?.trim();
    if (expressionStr && isPath(expressionStr)) {
      job.expression = await fetchFile(
        job.id || `${idx}`,
        rootDir,
        expressionStr,
        log
      );
    }
    if (configurationStr && isPath(configurationStr)) {
      const configString = await fetchFile(
        job.id || `${idx}`,
        rootDir,
        configurationStr,
        log
      );
      job.configuration = JSON.parse(configString!);
    }
  }
};

// TODO default the workflow name from the file name
const loadXPlan = async (
  plan: ExecutionPlan,
  options: Pick<Opts, 'monorepoPath' | 'baseDir' | 'expandAdaptors'>,
  logger: Logger
) => {
  if (!plan.options) {
    plan.options = {};
  }

  // Note that baseDir should be set up in the default function
  await importExpressions(plan, options.baseDir!, logger);
  // expand shorthand adaptors in the workflow jobs
  if (options.expandAdaptors) {
    expandAdaptors(plan);
  }
  await mapAdaptorsToMonorepo(options.monorepoPath, plan, logger);

  // Assign options form the CLI into the Xplan
  // TODO support state props to remove
  maybeAssign(options, plan.options, ['timeout', 'start']);

  return plan;
};
