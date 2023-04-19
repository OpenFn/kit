import path from 'node:path';
import fs from 'node:fs/promises';
import { isPath } from '@openfn/compiler';
import type { Logger } from '@openfn/logger';
import type { Opts } from '../options';

type LoadWorkflowOpts = Required<Pick<Opts, 'workflowPath' | 'workflow'>>;

export default async (
  opts: Pick<Opts, 'jobPath' | 'workflowPath' | 'workflow' | 'job'>,
  log: Logger
) => {
  log.debug('Loading input...');
  const { job, workflow, jobPath, workflowPath } = opts;
  if (workflow) return workflow;
  if (job) return job;
  if (workflowPath) {
    return loadWorkflow(opts as LoadWorkflowOpts, log);
  } else if (jobPath) {
    log.debug(`Loading job from ${jobPath}`);
    opts.job = await fs.readFile(jobPath, 'utf8');
    return opts.job;
  }
};

const loadWorkflow = async (opts: LoadWorkflowOpts, log: Logger) => {
  const { workflowPath } = opts;
  log.debug(`Loading workflow from ${workflowPath}`);
  try {
    const workflowRaw = await fs.readFile(workflowPath, 'utf8');

    const wf = JSON.parse(workflowRaw);
    // identify any expressions that are paths, and load them in
    // All paths are relative to the workflow itself

    const rootDir = path.dirname(workflowPath);
    for (const jobId in wf.jobs) {
      const job = wf.jobs[jobId];
      if (isPath(job.expression)) {
        // Special handling for ~ feels like a necessary evil
        const jobPath = job.expression.startsWith('~')
          ? job.expression
          : path.resolve(rootDir, wf.jobs[jobId].expression);
        const contents = await fs.readFile(jobPath, 'utf8');
        wf.jobs[jobId].expression = contents;
      }
    }

    opts.workflow = wf;
    log.debug('Workflow loaded!');
    return opts.workflow;
  } catch (e) {
    log.error(`Error loading workflow from ${workflowPath}`);
    throw e;
  }
};
