import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import * as l from '@openfn/lexicon';

import { Project } from '../Project';
import getIdentifier from '../util/get-identifier';
import { yamlToJson } from '../util/yaml';
import slugify from '../util/slugify';
import fromAppState from './from-app-state';

export type FromFsConfig = {
  root: string;
};

// Parse a single project from a root folder
// focus on this first
// root must be absolute?
export const parseProject = async (options: FromFsConfig = {}) => {
  const { root } = options;
  const proj = {};

  let config; // TODO need a type for the shape of this file
  try {
    // TODO any flex on the openfn.json file name?
    const file = await fs.readFile(
      path.resolve(path.join(root, 'openfn.yaml')),
      'utf8'
    );
    config = yamlToJson(file);
  } catch (e) {
    // Not found - try and parse as JSON
    try {
      const file = await fs.readFile(
        path.join(root || '.', 'openfn.json'),
        'utf8'
      );
      config = JSON.parse(file);
    } catch (e) {
      console.log(e);
      // TODO better error handling
      throw e;
    }
  }

  // Now we need to look for the corresponding state file
  // Need to load UUIDs and other app settings from this
  // If we load it as a Project, uuid tracking is way easier
  let state: Project;
  const identifier = getIdentifier({
    endpoint: config.project?.endpoint,
    env: config.project?.env,
  });
  try {
    const format = config.formats?.projects ?? 'yaml';
    const statePath = path.join(
      root,
      config.dirs.projects ?? '.projects',
      `${identifier}.${format}`
    );
    const stateFile = await fs.readFile(statePath, 'utf8');
    // Load the state contents as a Project
    state = fromAppState(stateFile, { format });
  } catch (e) {
    console.warn(`Failed to find state file for ${identifier}`);
    // console.warn(e);
  }
  // find the openfn settings

  const { project: openfn, ...repo } = config;
  proj.openfn = openfn;
  proj.config = repo;

  // now find all the workflows
  // this will find all json files in the workflows folder
  // TODO how can I prevent this loading huge data files?
  // I mean they shouldn't be there anyway but still
  const workflowDir =
    config.workflowRoot ?? config.dirs?.workflows ?? 'workflows';
  const fileType = config.formats?.workflow ?? 'yaml';
  const pattern = `${root}/${workflowDir}/*/*.${fileType}`;
  const candidateWfs = await glob(pattern, {
    ignore: ['**node_modules/**', '**tmp**'],
  });
  const workflows = [];

  for (const filePath of candidateWfs) {
    const candidate = await fs.readFile(filePath, 'utf-8');
    try {
      const wf =
        fileType === 'yaml' ? yamlToJson(candidate) : JSON.parse(candidate);
      if (wf.id && Array.isArray(wf.steps)) {
        // load settings from the state file
        const wfState = (state && state.getWorkflow(wf.id)) ?? {};
        wf.openfn = {
          uuid: wfState.openfn?.uuid ?? null,
          // TODO do we need to transfer more stuff?
        };

        console.log('Loading workflow at ', filePath); // TODO logger.debug
        for (const step of wf.steps) {
          if (step.expression && step.expression.endsWith('.js')) {
            const dir = path.dirname(filePath);
            const exprPath = path.join(dir, step.expression);
            try {
              console.debug(`Loaded expression from ${exprPath}`);
              step.expression = await fs.readFile(exprPath, 'utf-8');
            } catch (e) {
              console.error(`Error loading expression from ${exprPath}`);
              // throw?
            }
          }
          // check the state file for a matching uuid
          // TODO this isn't quite right - what if there are other openfn keys to write?
          // We need to return not just the UUID, but all the openfn keys
          // TODO do we need to slugify the id here? Not really tbh?
          const uuid = state?.getUUID(wf.id, step.id) ?? null;
          step.openfn = { uuid };

          // Now track UUIDs for edges against state
          for (const target in step.next || {}) {
            if (typeof step.next[target] === 'boolean') {
              const bool = step.next[target];
              step.next[target] = { condition: bool };
            }
            const uuid = state?.getUUID(wf.id, step.id, target) ?? null;
            step.next[target].openfn = { uuid };
          }
        }

        workflows.push(wf);
      }
    } catch (e) {
      console.log(e);
      // not valid json
      // should probably maybe a big deal about this huh?
      continue;
    }
  }
  // now for each workflow, read in the expression files

  proj.workflows = workflows;

  // TODO do the workflow folder and the workflows file need to be same name?

  // proj.openfn = {
  //   projectId: id,
  //   endpoint: config.endpoint,
  //   inserted_at,
  //   updated_at,
  // };

  // // TODO maybe this for local metadata, stuff that isn't synced?
  // proj.meta = {
  //   fetched_at: config.fetchedAt,
  // };

  // proj.workflows = state.workflows.map(mapWorkflow);
  return new Project(proj as l.Project, repo);
};

// Parse the filesystem for all projects
const parseRepo = () => {};
