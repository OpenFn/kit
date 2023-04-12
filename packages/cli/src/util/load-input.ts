import fs from 'node:fs/promises';
import type { Logger } from '@openfn/logger';
import type { Opts } from '../options';

export default async (
  opts: Pick<Opts, 'jobPath' | 'workflowPath' | 'workflow' | 'job'>,
  log: Logger
) => {
  log.debug('Loading input...');
  // but hang on, the workflow is just a json input
  const { jobPath, workflowPath } = opts;
  if (workflowPath) {
    log.debug(`Loading workflow from ${workflowPath}`);
    try {
      const workflowRaw = await fs.readFile(workflowPath, 'utf8');
      opts.workflow = JSON.parse(workflowRaw);
      log.debug('Workflow loaded!');
      return opts.workflow;
    } catch (e) {
      log.error(`Error loading workflow from ${workflowPath}`);
    }
  } else if (jobPath) {
    log.debug(`Loading job from ${jobPath}`);
    opts.job = await fs.readFile(jobPath, 'utf8');
    return opts.job;
  }
};
