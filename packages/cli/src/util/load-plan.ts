/*
 * New entry point for loading up the input/execution plan
   Note that htere's a lot of complexity from load input that I need to deal with here :(
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import abort from './abort';

import type { ExecutionPlan, Job, WorkflowOptions } from '@openfn/lexicon';
import type { Opts } from '../options';
import type { Logger } from './logger';
import { OldCLIWorkflow } from '../types';
import expandAdaptors from './expand-adaptors';
import mapAdaptorsToMonorepo, {
  MapAdaptorsToMonorepoOptions,
} from './map-adaptors-to-monorepo';

const loadPlan = async (
  options: Opts,
  logger: Logger
): Promise<ExecutionPlan> => {
  const { workflowPath, planPath, jobPath } = options;

  if (jobPath) {
    return loadExpression(options, logger);
  }

  const jsonPath = planPath || workflowPath;
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
  options: Opts,
  logger: Logger
): Promise<ExecutionPlan> => {
  const jobPath = options.jobPath!;

  logger.debug(`Loading job from ${jobPath}`);
  const expression = await fs.readFile(jobPath, 'utf8');
  const name = path.parse(jobPath).name;

  const step: Job = { expression };

  // The adaptor should have been expanded nicely already, so we don't need todo much here
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
  options: Opts,
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

// TODO default the workflow name from the file name
const loadXPlan = async (
  plan: ExecutionPlan,
  options: Opts,
  logger: Logger
) => {
  if (!plan.options) {
    plan.options = {};
  }

  // expand shorthand adaptors in the workflow jobs
  expandAdaptors(plan);
  await mapAdaptorsToMonorepo(options.monorepoPath, plan, logger);

  // TODO: write any options from the user onto the potions object

  return plan;
};
