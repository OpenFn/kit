import path from 'node:path';
import fs from 'node:fs/promises';
import { isPath } from '@openfn/compiler';
import type { Logger } from '@openfn/logger';
import type { Opts } from '../options';
import { CLIExecutionPlan } from '../types';
import { ExecutionPlan } from '@openfn/runtime';

type LoadWorkflowOpts = Required<
  Pick<Opts, 'workflowPath' | 'workflow' | 'baseDir'>
>;

export default async (
  opts: Pick<Opts, 'jobPath' | 'workflowPath' | 'workflow' | 'job'>,
  log: Logger
) => {
  log.debug('Loading input...');
  const { job, workflow, jobPath, workflowPath } = opts;
  if (workflow || workflowPath) {
    return loadWorkflow(opts as LoadWorkflowOpts, log);
  }

  if (job) {
    return job;
  }
  if (jobPath) {
    log.debug(`Loading job from ${jobPath}`);
    opts.job = await fs.readFile(jobPath, 'utf8');
    return opts.job;
  }
};

const fetchFile = (rootDir: string, filePath: string) => {
  // Special handling for ~ feels like a necessary evil
  const jobPath = filePath.startsWith('~')
    ? filePath
    : path.resolve(rootDir, filePath);
  return fs.readFile(jobPath, 'utf8');
};

const loadWorkflow = async (opts: LoadWorkflowOpts, log: Logger) => {
  const { workflowPath, workflow } = opts;
  log.debug(`Loading workflow from ${workflowPath}`);
  try {
    let wf: CLIExecutionPlan;
    let rootDir = opts.baseDir;
    if (workflowPath) {
      const workflowRaw = await fs.readFile(workflowPath, 'utf8');
      wf = JSON.parse(workflowRaw);
      if (!rootDir) {
        // TODO this may not be neccessary, but keeping just in case
        rootDir = path.dirname(workflowPath);
      }
    } else {
      wf = workflow as CLIExecutionPlan;
    }

    // identify any expressions/configs that are paths, and load them in
    // All paths are relative to the workflow itself
    for (const job of wf.jobs) {
      if (typeof job.expression === 'string' && isPath(job.expression)) {
        job.expression = await fetchFile(rootDir, job.expression);
      }
      if (typeof job.configuration === 'string' && isPath(job.configuration)) {
        const configString = await fetchFile(rootDir, job.configuration);
        job.configuration = JSON.parse(configString);
      }
    }

    opts.workflow = wf as ExecutionPlan;
    log.debug('Workflow loaded!');
    return opts.workflow;
  } catch (e) {
    log.error(`Error loading workflow from ${workflowPath}`);
    throw e;
  }
};
