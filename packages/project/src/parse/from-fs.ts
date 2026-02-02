import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import * as l from '@openfn/lexicon';

import { Project } from '../Project';
import { yamlToJson } from '../util/yaml';
import {
  buildConfig,
  loadWorkspaceFile,
  findWorkspaceFile,
} from '../util/config';
import { omit } from 'lodash-es';
import { Logger } from '@openfn/logger';
import omitNil from '../util/omit-nil';

export type FromFsConfig = {
  root: string;
  config?: Partial<l.WorkspaceConfig>;
  logger?: Logger;
  alias?: string;
};

// Parse a single project from a root folder
// Note that this does NOT attempt to load UUIDS from the project file
// It just builds the project on disk
// I suppose we could take an option?
export const parseProject = async (options: FromFsConfig) => {
  const { root, logger, alias } = options;

  const { type, content } = findWorkspaceFile(root);
  const context = loadWorkspaceFile(content, type as any);
  const config = buildConfig(options.config ?? context.workspace);

  const proj: any = {
    id: context.project?.id,
    name: context.project?.name,
    openfn: omit(context.project, ['id', 'forked_from']),
    config: config,
    workflows: [],
    cli: omitNil({
      forked_from: context.project.forked_from,
    }),
  };

  // now find all the workflows
  // this will find all json files in the workflows folder
  // TODO how can I prevent this loading huge data files?
  // I mean they shouldn't be there anyway but still
  const workflowDir =
    (config as any).workflowRoot ?? config.dirs?.workflows ?? 'workflows';
  const fileType = config.formats?.workflow ?? 'yaml';
  const pattern = path.resolve(root, workflowDir) + `/**/*.${fileType}`;
  const candidateWfs = await glob(pattern, {
    ignore: ['**node_modules/**', '**tmp**'],
  });

  for (const filePath of candidateWfs) {
    const candidate = await fs.readFile(filePath, 'utf-8');
    try {
      let wf =
        fileType === 'yaml' ? yamlToJson(candidate) : JSON.parse(candidate);

      if (wf.workflow) {
        // Support the { workflow, options } workflow format
        // TODO Would like to remove this on the next major
        if (wf.options) {
          const { start, ...rest } = wf.options;
          if (start) {
            wf.workflow.start = start;
          }
          if (rest) {
            wf.workflow.options = Object.assign({}, wf.workflow.options, rest);
          }
        }
        wf = wf.workflow;
      }

      if (wf.id && Array.isArray(wf.steps)) {
        //logger?.log('Loading workflow at ', filePath); // TODO logger.debug
        for (const step of wf.steps) {
          // This is the saved, remote view of the step
          // TODO if the id has changed, how do we track?
          if (step.expression && step.expression.endsWith('.js')) {
            const dir = path.dirname(filePath);
            const exprPath = path.join(dir, step.expression);
            try {
              logger?.debug(`Loaded expression from ${exprPath}`);
              step.expression = await fs.readFile(exprPath, 'utf-8');
            } catch (e) {
              logger?.error(`Error loading expression from ${exprPath}`);
              // throw?
            }
          }

          // convert edge conditions
          for (const target in step.next || {}) {
            if (typeof step.next[target] === 'boolean') {
              const bool = step.next[target];
              step.next[target] = { condition: bool };
            }
          }
        }

        proj.workflows.push(wf);
      }
    } catch (e) {
      logger?.log(e);
      // not valid json
      // should probably maybe a big deal about this huh?
      continue;
    }
  }

  return new Project(proj as l.Project, {
    alias,
    ...context.workspace,
  });
};
