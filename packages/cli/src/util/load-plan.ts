import fs from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { isPath } from '@openfn/compiler';
import { Workspace, yamlToJson } from '@openfn/project';

import abort from './abort';
import expandAdaptors from './expand-adaptors';
import mapAdaptorsToMonorepo from './map-adaptors-to-monorepo';
import type { ExecutionPlan, Job, WorkflowOptions } from '@openfn/lexicon';
import type { Opts } from '../options';
import type { Logger } from './logger';
import type { CLIExecutionPlan, CLIJobNode, OldCLIWorkflow } from '../types';
import resolvePath from './resolve-path';

const loadPlan = async (
  options: Pick<
    Opts,
    | 'expressionPath'
    | 'planPath'
    | 'workflowPath'
    | 'workflowName'
    | 'adaptors'
    | 'baseDir'
    | 'expandAdaptors'
    | 'path'
    | 'globals'
    | 'credentials'
  > & {
    workflow?: Opts['workflow'];
    workspace?: string; // from project opts
  },
  logger: Logger
): Promise<ExecutionPlan> => {
  // TODO all these paths probably need rethinkng now that we're supporting
  // so many more input formats
  const { workflowPath, planPath, expressionPath, workflowName } = options;

  let workflowObj;

  if (workflowName || options.workflow) {
    logger.debug(
      'Loading workflow from active project in workspace at ',
      options.workspace
    );
    const workspace = new Workspace(options.workspace!);
    const proj = await workspace.getCheckedOutProject();
    workflowObj = proj?.getWorkflow(workflowName || options.workflow!);

    if (!options.credentials) {
      options.credentials = workspace.getConfig().credentials;
    }
  }

  if (options.path && /ya?ml$/.test(options.path)) {
    const content = await fs.readFile(path.resolve(options.path), 'utf-8');
    options.baseDir = dirname(options.path);
    workflowObj = yamlToJson(content);
    const { options: o, ...rest } = workflowObj;
    // restructure the workflow so that options are not on the workflow object,
    // but part of hte execution plan options instead
    if (!workflowObj.workflow && workflowObj.options) {
      workflowObj = { workflow: rest, options: o };
    }
  }

  if (!workflowObj && expressionPath) {
    return loadExpression(options, logger);
  }

  const jsonPath = planPath || workflowPath;

  if (jsonPath && !options.baseDir) {
    options.baseDir = path.dirname(jsonPath);
  }

  workflowObj = workflowObj ?? (await loadJson(jsonPath!, logger));
  const defaultName = workflowObj.name || path.parse(jsonPath ?? '').name;

  // Support very old workflow formats
  if (workflowObj.jobs) {
    return loadOldWorkflow(workflowObj, options, logger, defaultName);
  }
  // support workflow saved like { workflow, options }
  else if (workflowObj.workflow) {
    return loadXPlan(
      workflowObj,
      Object.assign({}, workflowObj.options, options),
      logger,
      defaultName
    );
  } else {
    // This is the main route now - just load the workflow from the file
    return loadXPlan({ workflow: workflowObj }, options, logger, defaultName);
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
    const fullPath = resolvePath(filePath, rootDir);
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
  if (fnStr) {
    if (isPath(fnStr)) {
      plan.workflow.globals = await fetchFile(
        { name: 'globals', rootDir, filePath: fnStr },
        log
      );
    } else {
      plan.workflow.globals = fnStr;
    }
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

type ensureCollectionsOptions = {
  endpoint?: string;
  version?: string;
  apiKey?: string;
};

const ensureCollections = (
  plan: CLIExecutionPlan,
  {
    endpoint = 'https://app.openfn.org',
    version = 'latest',
    apiKey = 'null',
  }: ensureCollectionsOptions = {},
  logger?: Logger
) => {
  let collectionsFound = false;

  Object.values(plan.workflow.steps)
    .filter((step) => (step as any).expression?.match(/(collections\.)/))
    .forEach((step) => {
      const job = step as CLIJobNode;
      if (
        !job.adaptors?.find((v: string) =>
          v.startsWith('@openfn/language-collections')
        )
      ) {
        collectionsFound = true;
        job.adaptors ??= [];
        job.adaptors.push(
          `@openfn/language-collections@${version || 'latest'}`
        );

        job.configuration = Object.assign({}, job.configuration, {
          collections_endpoint: `${endpoint}/collections`,
          collections_token: apiKey,
        });
      }
    });

  if (collectionsFound) {
    if (!apiKey || apiKey === 'null') {
      logger?.warn(
        'WARNING: collections API was not set. Pass --api-key or OPENFN_API_KEY'
      );
    }
    logger?.info(
      `Configured collections to use endpoint ${endpoint} and API Key ending with ${apiKey?.substring(
        apiKey.length - 10
      )}`
    );
  }
};

const loadXPlan = async (
  plan: CLIExecutionPlan,
  options: Pick<
    Opts,
    | 'monorepoPath'
    | 'baseDir'
    | 'expandAdaptors'
    | 'globals'
    | 'collectionsVersion'
    | 'collectionsEndpoint'
    | 'apiKey'
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
  ensureCollections(
    plan,
    {
      version: options.collectionsVersion,
      apiKey: options.apiKey,
      endpoint: options.collectionsEndpoint,
    },
    logger
  );

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
