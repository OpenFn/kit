import { confirm } from '@inquirer/prompts';
import { inspect } from 'node:util';
import { DeployConfig, ProjectState } from './types';
import { readFile, writeFile } from 'fs/promises';
import { parseAndValidate } from './validator';
import jsondiff from 'json-diff';
import {
  mergeProjectPayloadIntoState,
  mergeSpecIntoState,
  toProjectPayload,
} from './stateTransform';
import { deployProject,  getProject } from './client';
import { DeployError } from './deployError';
import { Logger } from '@openfn/logger';
// =============== Configuration ===============

function mergeDefaultOptions(options: Partial<DeployConfig>): DeployConfig {
  return {
    apiKey: null,
    configPath: '.config.json',
    specPath: 'project.yaml',
    statePath: '.state.json',
    endpoint: 'https://app.openfn.org/api/provision',
    requireConfirmation: true,
    dryRun: false,
    ...options,
  };
}

export { getProject, mergeSpecIntoState}; 

export async function getConfig(path?: string): Promise<DeployConfig> {
  try {
    return mergeDefaultOptions(
      JSON.parse(await readFile(path ?? '.config.json', 'utf8'))
    );
  } catch (error) {
    return mergeDefaultOptions({});
  }
}



export function validateConfig(config: DeployConfig) {
  if (!config.apiKey) {
    throw new DeployError('Missing API key', 'CONFIG_ERROR');
  }

  try {
    new URL(config.endpoint);
  } catch (error: any) {
    if (error.code === 'ERR_INVALID_URL') {
      throw new DeployError('Invalid endpoint', 'CONFIG_ERROR');
    } else {
      throw error;
    }
  }
}

// =================== State ===================

async function readState(path: string) {
  const state = await readFile(path, 'utf8');

  return JSON.parse(state) as ProjectState;
}

export async function getState(path: string) {
  try {
    return await readState(path);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { workflows: {} } as ProjectState;
    } else {
      throw error;
    }
  }
}

function writeState(config: DeployConfig, nextState: {}): Promise<void> {
  return writeFile(config.statePath, JSON.stringify(nextState, null, 2));
}

// ==================== Spec ===================

// Given a path to a project spec, read and validate it.
async function getSpec(path: string) {
  try {
    const body = await readFile(path, 'utf8');
    return parseAndValidate(body);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new DeployError(`File not found: ${path}`, 'SPEC_ERROR');
    } else {
      throw error;
    }
  }
}



// =============================================

export async function deploy(config: DeployConfig, logger: Logger) {
  const [state, spec] = await Promise.all([
    getState(config.statePath),
    getSpec(config.specPath),
  ]);

  logger.debug('spec', spec);
  if (spec.errors.length > 0) {
    spec.errors.forEach((e) => logger.warn(e.message));
    throw new DeployError(`${config.specPath} has errors`, 'VALIDATION_ERROR');
  }
  const nextState = mergeSpecIntoState(state, spec.doc);

  validateProjectState(nextState);

  // Convert the state to a payload for the API.
  const nextProject = toProjectPayload(nextState);

  logger.info('Getting project from server...');
  const { data: currentProject } = await getProject(config, nextState.id);

  logger.debug(
    'currentProject',
    '\n' + inspect(currentProject, { colors: true })
  );
  logger.debug('nextProject', '\n' + inspect(nextProject, { colors: true }));

  const diff = jsondiff.diffString(currentProject, nextProject);

  if (!diff) {
    logger.always('No changes to deploy.');
    return true;
  }

  logger.always(`Changes:\n${diff}`);

  if (config.dryRun) {
    return true;
  }

  if (config.requireConfirmation) {
    if (!(await confirm({ message: 'Deploy?', default: false }))) {
      logger.always('Cancelled.');
      return false;
    }
  }

  const { data: deployedProject } = await deployProject(config, nextProject);

  logger.debug('deployedProject', deployedProject);
  const deployedState = mergeProjectPayloadIntoState(
    nextState,
    deployedProject
  );

  // IDEA: perhaps before writing, we should check if the current project.yaml
  // merges into the deployed state to produce the current state. If not, we
  // should warn the user that the project.yaml is out of sync with the server?

  await writeState(config, deployedState);

  logger.always('Deployed.');
  return true;
}

function validateProjectState(state: ProjectState) {
  if (!state.workflows) {
    throw new DeployError(
      'Project state must have a workflows property',
      'STATE_ERROR'
    );
  }
}

export type { DeployConfig, ProjectState };
export { DeployError };
