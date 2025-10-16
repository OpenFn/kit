import { Workspace } from '@openfn/project';
import path from 'path';
import type { Logger } from '../util/logger';
import type { VersionOptions } from './command';

const workflowVersionHandler = async (
  options: VersionOptions,
  logger: Logger
) => {
  const commandPath = path.resolve(options.projectPath ?? '.');
  const workspace = new Workspace(commandPath);
  if (!workspace.valid) {
    logger.error('Command was run in an invalid openfn workspace');
    return;
  }

  const output = new Map<string, string>();

  const activeProject = workspace.getActiveProject();
  if (options.workflow) {
    const workflow = activeProject?.getWorkflow(options.workflow);
    if (!workflow) {
      logger.error(`No workflow found with id/name ${options.workflow}`);
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

export default workflowVersionHandler;
