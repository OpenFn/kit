import fs from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { isPath } from '@openfn/compiler';
import Project, { yamlToJson } from '@openfn/project';

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
    | 'path'
    | 'globals'
  > & {
    workflow?: Opts['workflow'];
  },
  logger: Logger
): Promise<ExecutionPlan> => {
  // TODO all these paths probably need rethinkng now that we're supporting
  // so many more input formats
  const { workflowPath, planPath, expressionPath } = options;

  if (options.path && /ya?ml$/.test(options.path)) {
    const content = await fs.readFile(path.resolve(options.path), 'utf-8');
    const workflow = yamlToJson(content);
    options.baseDir = dirname(options.path);
    return loadXPlan({ workflow }, options, logger);
  }

  // Run a workflow from a project, with a path and workflow name
  if (options.path && options.workflow) {
    options.baseDir = options.path;
    return fromProject(options.path, options.workflow, options, logger);
  }

  // Run a workflow from a project in the current working dir
  // (no expression or workflow path, and no file extension)
  if (
    !expressionPath &&
    !workflowPath &&
    !/\.(js|json|yaml)+$/.test(options.path || '') &&
    !options.workflow
  ) {
    // If the path has no extension
    // Run a workflow from a project in the working dir
    const workflow = options.path;
    return fromProject(path.resolve('.'), workflow!, options, logger);
  }

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

const fromProject = async (
  rootDir: string,
  workflowName: string,
  options: Partial<Opts>,
  logger: Logger
): Promise<any> => {
  logger.debug('Loading Repo from ', path.resolve(rootDir));
  const project = await Project.from('fs', { root: rootDir });
  logger.debug('Loading workflow ', workflowName);
  const workflow = project.getWorkflow(workflowName);
  if (!workflow) {
    throw new Error(`Workflow "${workflowName}" not found`);
  }
  return loadXPlan({ workflow }, options, logger);
};

// load a workflow from a repo
// if you do `openfn wf1` then we use this - you've asked for a workflow name, which we'll find
// const loadRepo = () => {};

// Load a workflow straight from yaml
// const loadYaml = () => {};

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
  options: Pick<
    Opts,
    'expressionPath' | 'adaptors' | 'monorepoPath' | 'globals'
  >,
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
        globals: options.globals,
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
  fileInfo: {
    name: string;
    rootDir?: string;
    filePath: string;
  },
  log: Logger
) => {
  const { rootDir = '', filePath, name } = fileInfo;
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
      `File not found for ${name}: ${filePath}`,
      undefined,
      `This workflow references a file which cannot be found at ${filePath}\n\nPaths inside the workflow are relative to the workflow.json`
    );

    // should never get here
    return '.';
  }
};

const importGlobals = async (
  plan: CLIExecutionPlan,
  rootDir: string,
  log: Logger
) => {
  const fnStr = plan.workflow?.globals;
  if (!fnStr) return;
  if (isPath(fnStr))
    plan.workflow.globals = await fetchFile(
      { name: 'globals', rootDir, filePath: fnStr },
      log
    );
  else plan.workflow.globals = fnStr;
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
        {
          name: `job ${job.id || idx}`,
          rootDir,
          filePath: expressionStr,
        },
        log
      );
    }
    if (configurationStr && isPath(configurationStr)) {
      const configString = await fetchFile(
        {
          name: `job configuration ${job.id || idx}`,
          rootDir,
          filePath: configurationStr,
        },
        log
      );
      job.configuration = JSON.parse(configString!);
    }
    if (stateStr && isPath(stateStr)) {
      const stateString = await fetchFile(
        {
          name: `job state ${job.id || idx}`,
          rootDir,
          filePath: stateStr,
        },
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
  options: Pick<
    Opts,
    'monorepoPath' | 'baseDir' | 'expandAdaptors' | 'globals'
  >,
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
  // if globals is provided via cli argument. it takes precedence
  if (options.globals) plan.workflow.globals = options.globals;
  await importGlobals(plan, options.baseDir!, logger);

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
