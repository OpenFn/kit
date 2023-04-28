import path from 'node:path';
import fs from 'node:fs/promises';
import { isPath } from '@openfn/compiler';
import type { Logger } from '@openfn/logger';
import type { Opts } from '../options';
import { CLIExecutionPlan } from '../types';
import { ExecutionPlan } from '@openfn/runtime';
import abort from './abort';

type LoadWorkflowOpts = Required<
  Pick<Opts, 'workflowPath' | 'workflow' | 'baseDir'>
>;

export default async (
  opts: Pick<Opts, 'jobPath' | 'workflowPath' | 'workflow' | 'job'>,
  log: Logger
) => {
  const { job, workflow, jobPath, workflowPath } = opts;
  if (workflow || workflowPath) {
    return loadWorkflow(opts as LoadWorkflowOpts, log);
  }

  if (job) {
    return job;
  }
  if (jobPath) {
    try {
      log.debug(`Loading job from ${jobPath}`);
      opts.job = await fs.readFile(jobPath, 'utf8');
      return opts.job;
    } catch (e) {
      abort(
        log,
        'Job not found',
        undefined,
        `Failed to load the job from ${jobPath}`
      );
    }
  }
};

const loadWorkflow = async (opts: LoadWorkflowOpts, log: Logger) => {
  const { workflowPath, workflow } = opts;

  const readWorkflow = async () => {
    try {
      const text = await fs.readFile(workflowPath, 'utf8');
      return text;
    } catch (e) {
      abort(
        log,
        'Workflow not found',
        undefined,
        `Failed to load a workflow from ${workflowPath}`
      );
    }
  };

  const parseWorkflow = (contents: string) => {
    try {
      return JSON.parse(contents);
    } catch (e) {
      abort(
        log,
        'Invalid JSON in workflow',
        e,
        `Check the syntax of the JSON at ${workflowPath}`
      );
    }
  };

  const fetchWorkflowFile = async (
    jobId: string,
    rootDir: string = '',
    filePath: string
  ) => {
    try {
      // Special handling for ~ feels like a necessary evil
      const fullPath = filePath.startsWith('~')
        ? filePath
        : path.resolve(rootDir, filePath);
      const result = await fs.readFile(fullPath, 'utf8');
      return result;
    } catch (e) {
      abort(
        log,
        `File not found for job ${jobId}: ${filePath}`,
        undefined,
        `This workflow references a file which cannot be found at ${filePath}\n\nPaths inside the workflow are relative to the workflow.json`
      );
    }
  };

  log.debug(`Loading workflow from ${workflowPath}`);
  try {
    let wf: CLIExecutionPlan;
    let rootDir = opts.baseDir;
    if (workflowPath) {
      let workflowRaw = await readWorkflow();
      wf = parseWorkflow(workflowRaw!);

      if (!rootDir) {
        // TODO this may not be neccessary, but keeping just in case
        rootDir = path.dirname(workflowPath);
      }
    } else {
      wf = workflow as CLIExecutionPlan;
    }

    // TODO auto generate ids?

    // identify any expressions/configs that are paths, and load them in
    // All paths are relative to the workflow itself
    let idx = 0;
    for (const job of wf.jobs) {
      idx += 1;
      const expression = job.expression?.trim();
      const configuration = job.configuration?.trim();
      if (typeof expression === 'string' && isPath(expression)) {
        job.expression = await fetchWorkflowFile(
          job.id || `${idx}`,
          rootDir,
          expression
        );
      }
      if (typeof configuration === 'string' && isPath(configuration)) {
        const configString = await fetchWorkflowFile(
          job.id || `${idx}`,
          rootDir,
          configuration
        );
        job.configuration = JSON.parse(configString!);
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
