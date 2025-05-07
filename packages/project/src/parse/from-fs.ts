import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { Project } from '../Project';
import { yamlToJson } from '../util/yaml';

// Parse a single project from a root folder
// focus on this first
// root must be absolute?
export const parseProject = async (root: string) => {
  const proj = {};

  let config;
  try {
    // TODO any flex on the openfn.json file name?
    const file = await fs.readFile(path.join(root, 'openfn.yaml'), 'utf8');
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
        }
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
