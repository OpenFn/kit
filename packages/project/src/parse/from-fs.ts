import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import * as l from '@openfn/lexicon';

import { Project } from '../Project';
import getIdentifier from '../util/get-identifier';
import { yamlToJson } from '../util/yaml';
import {
  buildConfig,
  loadWorkspaceFile,
  findWorkspaceFile,
} from '../util/config';
import fromProject from './from-project';
import { omit } from 'lodash-es';

export type FromFsConfig = {
  root: string;
};

// Parse a single project from a root folder
export const parseProject = async (options: FromFsConfig) => {
  const { root } = options;

  const { type, content } = findWorkspaceFile(root);
  const context = loadWorkspaceFile(content, type as any);
  const config = buildConfig(context.workspace);

  // Now we need to look for the corresponding state file
  // Need to load UUIDs and other app settings from this
  // If we load it as a Project, uuid tracking is way easier
  let state: Project | null = null;
  const identifier = getIdentifier({
    endpoint: context.project?.endpoint,
    env: context.project?.env,
  });
  try {
    const format = config.formats?.project ?? config.formats?.project ?? 'yaml';
    const statePath = path.join(
      root,
      config.dirs?.projects ?? '.projects',
      `${identifier}.${format}`
    );
    const stateFile = await fs.readFile(statePath, 'utf8');

    state = fromProject(stateFile, config);
  } catch (e) {
    console.warn(`Failed to find state file for ${identifier}`);
    // console.warn(e);
  }

  const proj: any = {
    name: state?.name,
    openfn: omit(context.project, ['id']),
    config: config,
    workflows: [],
  };

  // now find all the workflows
  // this will find all json files in the workflows folder
  // TODO how can I prevent this loading huge data files?
  // I mean they shouldn't be there anyway but still
  const workflowDir =
    (config as any).workflowRoot ?? config.dirs?.workflows ?? 'workflows';
  const fileType = config.formats?.workflow ?? 'yaml';
  const pattern = `${root}/${workflowDir}/*/*.${fileType}`;
  const candidateWfs = await glob(pattern, {
    ignore: ['**node_modules/**', '**tmp**'],
  });

  for (const filePath of candidateWfs) {
    const candidate = await fs.readFile(filePath, 'utf-8');
    try {
      const wf =
        fileType === 'yaml' ? yamlToJson(candidate) : JSON.parse(candidate);
      if (wf.id && Array.isArray(wf.steps)) {
        // load settings from the state file
        const wfState = state?.getWorkflow(wf.id);

        wf.openfn = Object.assign({}, wfState?.openfn, {
          uuid: wfState?.openfn?.uuid ?? null,
        });

        //console.log('Loading workflow at ', filePath); // TODO logger.debug
        for (const step of wf.steps) {
          // This is the saved, remote view of the step
          // TODO if the id has changed, how do we track?
          const stateStep = wfState?.get(step.id);
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
          step.openfn = Object.assign({}, stateStep?.openfn);

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

        proj.workflows.push(wf);
      }
    } catch (e) {
      console.log(e);
      // not valid json
      // should probably maybe a big deal about this huh?
      continue;
    }
  }

  return new Project(proj as l.Project, context.workspace);
};
