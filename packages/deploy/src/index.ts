import { confirm } from '@inquirer/prompts';
import { DeployOptions, ProjectState } from './types';
import { readFile, writeFile } from 'fs/promises';
import { validate } from './validator';
import jsondiff from 'json-diff';
import {
  mergeProjectPayloadIntoState,
  mergeSpecIntoState,
  toProjectPayload,
} from './stateTransform';
import { deployProject, getProject } from './client';

// =============== Configuration ===============

const defaultOptions: DeployOptions = {
  apiKey: null,
  specPath: 'project.yaml',
  statePath: '.state.json',
  endpoint: 'https://app.openfn.org/api/provision',
  requireConfirmation: true,
  dryRun: false,
};

async function getConfig(path?: string): Promise<DeployOptions> {
  // TODO: merge env vars into either defaultOptions or config file results
  // TODO: validate config after merging/reading
  try {
    const config = await readFile(path ?? '.config.json', 'utf8');
    return JSON.parse(config);
  } catch (error) {
    return defaultOptions;
  }
}

function validateConfig(config: DeployOptions) {
  if (!config.apiKey) {
    throw new Error('Missing API key');
  }

  try {
    new URL(config.endpoint);
  } catch (error) {
    if (error.code === 'ERR_INVALID_URL') {
      throw new Error('Invalid endpoint');
    } else {
      throw error;
    }
  }
}

// =============================================

export async function deploy(config: DeployOptions) {
  const [state, spec] = await Promise.all([
    readState(config.statePath),
    readSpec(config.specPath),
  ]);

  const nextState = mergeSpecIntoState(state, spec.doc);

  validateProjectState(nextState);

  // Convert the state to a payload for the API.
  const nextProject = toProjectPayload(nextState);
  const currentProject = await getProject(config, nextState.id);

  renderDiff(currentProject, nextProject);

  if (config.dryRun) {
    return;
  }

  if (config.requireConfirmation) {
    if (!(await confirm({ message: 'Deploy?' }))) {
      console.log('Aborting.');
      return;
    }
  }

  const deployedProject = await deployProject(config, nextProject);

  const deployedState = mergeProjectPayloadIntoState(nextState, deployedProject);

  // IDEA: perhaps before writing, we should check if the current project.yaml
  // merges into the deployed state to produce the current state. If not, we
  // should warn the user that the project.yaml is out of sync with the server?

  await writeState(config, deployedState);
}

function validateProjectState(state: ProjectState) {
  if (!state.workflows) {
    throw new Error('Project state must have a workflows property');
  }
}

// Given a path to a project spec, read and validate it.
async function readSpec(path: string) {
  const body = await readFile(path, 'utf8');
  return validate(body);
}

async function readState(path: string) {
  const state = await readFile(path, 'utf8');

  return JSON.parse(state) as ProjectState;
}

function renderDiff(before: {}, after: {}) {
  console.log(jsondiff.diffString(before, after));
}

function writeState(config: DeployOptions, nextState: {}): Promise<void> {
  return writeFile(config.statePath, JSON.stringify(nextState, null, 2));
}
