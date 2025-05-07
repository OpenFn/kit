import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import * as l from '@openfn/lexicon';

import { Project } from '../Project';
import getIdentifier from '../util/get-identifier';
import { yamlToJson } from '../util/yaml';
import slugify from '../util/slugify';

// Parse a single project from a root folder
// focus on this first
// root must be absolute?
export const parseProject = async (root: string = '.') => {
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
      const file = await fs.readFile(path.join(root, 'openfn.json'), 'utf8');
      config = JSON.parse(file);
    } catch (e) {
      console.log(e);
      // TODO better error handling
      throw e;
    }
  }

  // Now we need to look for the corresponding state file
  // Need to load UUIDs and other app settings from this
  let state = {};
  const identifier = getIdentifier({
    endpoint: config.project?.endpoint,
    env: config.project?.env,
  });
  try {
    const format = config.formats.project ?? 'yaml';
    const statePath = path.join(root, '.projects', `${identifier}.${format}`);
    const stateFile = await fs.readFile(statePath, 'utf8');
    if (format === 'json') {
      state = JSON.parse(stateFile);
    } else {
      state = yamlToJson(stateFile);
    }
    console.log({ state });
  } catch (e) {
    console.warn(`Failed to find state file for ${identifier}`);
    console.warn(e);
  }
  // find the openfn settings

  const { project: openfn, ...repo } = config;
  proj.openfn = openfn;

  // now find all the workflows
  // this will find all json files in the workflows folder
  // TODO how can I prevent this loading huge data files?
  // I mean they shouldn't be there anyway but still
  const workflowDir = config.workflowRoot ?? 'workflows';
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
        const wfState = state?.workflows.find((w) => w.name === wf.id);
        const lookup = {};
        if (wfState) {
          ['jobs', 'triggers'].forEach((type) => {
            wfState[type].forEach((item) => {
              if (item.name) {
                lookup[slugify(item.name)] = item;
              }
            });
          });
        }
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
          const name = slugify(step.id);
          if (name in lookup) {
            // find all the app-only properties
            // This must be common code we can reuse?
            const {
              name: _name,
              body,
              adaptor,
              enabled,
              ...rest
            } = lookup[name];
            step.openfn = rest;
          }
        }
        // TODO tracking edges is gonna be really hard no?
        // something is amiss here I think
        workflows.push(wf);
      }
    } catch (e) {
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
