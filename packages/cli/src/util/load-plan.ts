import fs from 'node:fs/promises';
import path from 'node:path';
import { isPath } from '@openfn/compiler';

import abort from './abort';
import expandAdaptors from './expand-adaptors';
import mapAdaptorsToMonorepo from './map-adaptors-to-monorepo';
import type { ExecutionPlan, Job, WorkflowOptions } from '@openfn/lexicon';
import type { Opts } from '../options';
import type { Logger } from './logger';
import type { CLIExecutionPlan, CLIJobNode, OldCLIWorkflow } from '../types';

const loadPlan = async (
  options: Pick<
    Opts,
    | 'expressionPath'
    | 'planPath'
    | 'workflowPath'
    | 'adaptors'
    | 'baseDir'
    | 'expandAdaptors'
  >,
  logger: Logger
): Promise<ExecutionPlan> => {
  const { workflowPath, planPath, expressionPath } = options;

  if (expressionPath) {
    return loadExpression(options, logger);
  }

  const jsonPath = planPath || workflowPath;

  if (!options.baseDir) {
    options.baseDir = path.dirname(jsonPath!);
  }

  const json = await loadJson(jsonPath!, logger);
  const defaultName = path.parse(jsonPath!).name;

  if (json.workflow) {
    return loadXPlan(json, options, logger, defaultName);
  } else {
    return loadOldWorkflow(json, options, logger, defaultName);
  }
};

export default loadPlan;

const loadJson = async (workflowPath: string, logger: Logger): Promise<any> => {
  let text: string;

  try {
    text = await fs.readFile(workflowPath, 'utf8');
    logger.debug('Loaded workflow from', workflowPath);
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
  options: Pick<Opts, 'expressionPath' | 'adaptors' | 'monorepoPath'>,
  logger: Logger
): Promise<ExecutionPlan> => {
  const expressionPath = options.expressionPath!;

  logger.debug(`Loading expression from ${expressionPath}`);
  try {
    const expression = await fs.readFile(expressionPath, 'utf8');
    const name = path.parse(expressionPath).name;

    const step: Job = {
      expression,
      // The adaptor should have been expanded nicely already, so we don't need intervene here
      adaptors: options.adaptors ?? [],
    };

    const wfOptions: WorkflowOptions = {};
    // TODO support state props to remove?
    maybeAssign(options, wfOptions, ['timeout']);

    const plan: CLIExecutionPlan = {
      workflow: {
        name,
        steps: [step],
      },
      options: wfOptions,
    };
    // call loadXPlan now so that any options can be written
    return loadXPlan(plan, options, logger);
  } catch (e) {
    abort(
      logger,
      'Expression not found',
      undefined,
      `Failed to load the expression from ${expressionPath}`
    );

    // This will never execute
    return {} as CLIExecutionPlan;
  }
};

const loadOldWorkflow = async (
  workflow: OldCLIWorkflow,
  options: Pick<Opts, 'workflowPath' | 'monorepoPath'>,
  logger: Logger,
  defaultName: string = ''
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

  // call loadXPlan now so that any options can be written
  const final = await loadXPlan(plan, options, logger, defaultName);

  logger.warn('Converted workflow into new format:');
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
    log.debug('Loaded file', fullPath);
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

const importFunctions = async (
  plan: CLIExecutionPlan,
  rootDir: string,
  log: Logger
) => {
  const fnStr = plan.workflow?.functions;
  if (fnStr && isPath(fnStr)) {
    // FIXME: fetchFile function isn't generic enough
    plan.workflow.functions = await fetchFile(
      'global functions',
      rootDir,
      fnStr,
      log
    );
  }
};

// TODO this is currently untested in load-plan
// (but covered a bit in execute tests)
const importExpressions = async (
  plan: CLIExecutionPlan,
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
    const stateStr = typeof job.state === 'string' && job.state?.trim();

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
    if (stateStr && isPath(stateStr)) {
      const stateString = await fetchFile(
        job.id || `${idx}`,
        rootDir,
        stateStr,
        log
      );
      job.state = JSON.parse(stateString!);
    }
  }
};

// Allow users to specify a single adaptor on a job,
// but convert the internal representation into an array
const ensureAdaptors = (plan: CLIExecutionPlan) => {
  Object.values(plan.workflow.steps).forEach((step) => {
    const job = step as CLIJobNode;
    if (job.adaptor) {
      job.adaptors = [job.adaptor];
      delete job.adaptor;
    }
    // Also, ensure there is an empty adaptors array, which makes everything else easier
    job.adaptors ??= [];
  });
};

const loadXPlan = async (
  plan: CLIExecutionPlan,
  options: Pick<Opts, 'monorepoPath' | 'baseDir' | 'expandAdaptors'>,
  logger: Logger,
  defaultName: string = ''
) => {
  if (!plan.options) {
    plan.options = {};
  }

  if (!plan.workflow.name && defaultName) {
    plan.workflow.name = defaultName;
  }
  ensureAdaptors(plan);

  // import global functions
  await importFunctions(plan, options.baseDir!, logger);

  // Note that baseDir should be set up in the default function
  await importExpressions(plan, options.baseDir!, logger);
  // expand shorthand adaptors in the workflow jobs
  if (options.expandAdaptors) {
    expandAdaptors(plan);
  }
  await mapAdaptorsToMonorepo(options.monorepoPath, plan, logger);

  // Assign options from the CLI into the Xplan
  // TODO support state props to remove
  maybeAssign(options, plan.options, ['timeout', 'start']);

  logger.info(`Loaded workflow ${plan.workflow.name ?? ''}`);

  return plan as ExecutionPlan;
};
