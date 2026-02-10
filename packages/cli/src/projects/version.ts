import yargs from 'yargs';
import { Workspace } from '@openfn/project';

import { ensure, build } from '../util/command-builders';
import type { Logger } from '../util/logger';
import * as o from '../options';
import * as po from './options';

import type { Opts } from './options';

export type VersionOptions = Required<
  Pick<Opts, 'command' | 'workflow' | 'workspace' | 'workflowMappings' | 'json'>
>;

const options = [o.workflow, po.workspace, po.workflowMappings];

const command: yargs.CommandModule = {
  command: 'version [workflow]',
  describe: 'Returns the version hash of a given workflow in a workspace',
  handler: ensure('project-version', options),
  builder: (yargs) => build(options, yargs),
};

export default command;

export const handler = async (options: VersionOptions, logger: Logger) => {
  const workspace = new Workspace(options.workspace);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  const output = new Map<string, string>();

  const activeProject = workspace.getActiveProject();
  if (options.workflow) {
    const workflow = activeProject?.getWorkflow(options.workflow);
    if (!workflow) {
      logger.error(`No workflow found with id ${options.workflow}`);
      return;
    }
    output.set(workflow.name || workflow.id, workflow.getVersionHash());
  } else {
    for (const wf of activeProject?.workflows || []) {
      output.set(wf.name || wf.id, wf.getVersionHash());
    }
  }
  if (!output.size) {
    logger.error('No workflow available');
    return;
  }

  let final: string;
  if (options.json) {
    final = JSON.stringify(Object.fromEntries(output), undefined, 2);
  } else {
    final = Array.from(output.entries())
      .map(([key, value]) => key + '\n' + value)
      .join('\n\n');
  }
  logger.success(`Workflow(s) and their hashes\n\n${final}`);
};
