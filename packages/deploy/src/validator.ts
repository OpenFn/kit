import YAML, { YAMLMap, isMap, isPair, isScalar } from 'yaml';
import { ProjectSpec } from './types';
import { readFile } from 'fs/promises';
import path from 'path';

export interface Error {
  context: any;
  message: string;
  path: string; // human readable path to the error (ie, workflow-1/job-2)
  range?: [number, number, number];
}

export async function parseAndValidate(
  input: string,
  specPath: string = '.'
): Promise<{
  errors: Error[];
  doc: ProjectSpec;
}> {
  let errors: Error[] = [];
  const doc = YAML.parseDocument(input);
  const basePath = path.dirname(specPath);

  function ensureUniqueId(key: string, arr: string[]) {
    if (arr.includes(key)) {
      throw `duplicate id: ${key}`;
    } else {
      arr.push(key);
    }
  }

  function validateJobs(
    workflowName: string,
    workflow: YAMLMap,
    jobKeys: string[]
  ) {
    const jobs = workflow.getIn(['jobs']);

    if (jobs) {
      if (isMap(jobs)) {
        for (const job of jobs.items) {
          if (isPair(job)) {
            const jobName = (job as any).key.value;
            try {
              ensureUniqueId(jobName, jobKeys);
            } catch (err: any) {
              errors.push({
                path: `${workflowName}/${jobName}`,
                context: job,
                message: err,
              });
            }
          }
        }
      } else {
        errors.push({
          path: 'workflow',
          context: jobs,
          message: 'jobs: must be a map',
        });
      }
    }
  }

  function validateWorkflows(workflows: any) {
    if (typeof workflows === 'undefined') {
      // allow workflows to be unspecified, but ensure there is an empty
      // map to avoid errors downstream
      doc.setIn(['workflows'], {});
    } else if (isMap(workflows)) {
      const workflowKeys: string[] = [];
      for (const workflow of workflows.items) {
        if (isPair(workflow)) {
          const workflowName = (workflow as any).key.value;
          const jobKeys: string[] = [];
          try {
            ensureUniqueId(workflowName, workflowKeys);
          } catch (err: any) {
            errors.push({
              path: `${workflowName}`,
              context: workflow,
              message: err,
            });
          }
          const workflowValue = (workflow as any).value;
          if (isMap(workflowValue)) {
            validateJobs(workflowName, workflowValue, jobKeys);
          } else {
            errors.push({
              context: workflowValue,
              message: `${workflowName}: must be a map`,
              path: 'workflowName',
            });
          }
        }
      }
    } else {
      errors.push({
        context: workflows,
        message: 'must be a map',
        path: 'workflows',
      });
    }
  }

  await YAML.visitAsync(doc, {
    async Pair(_, pair: any, pairPath) {
      if (pair.key && pair.key.value === 'workflows') {
        if (pair.value.value === null) {
          errors.push({
            context: pair,
            message: 'project: must provide at least one workflow',
            path: 'workflows',
          });

          return doc.createPair('workflows', {});
        }
      }

      if (pair.key && pair.key.value === 'jobs') {
        if (pair.value.value === null) {
          errors.push({
            path: 'workflows',
            context: pair,
            message: 'jobs: must be a map',
            range: pair.value.range,
          });

          return doc.createPair('jobs', {});
        }
      }

      if (
        pair.key &&
        pair.key.value === 'body' &&
        pairPath.length > 4 &&
        isMap(pair.value)
      ) {
        const pathValue = pair.value.get('path');
        const grandPair = pairPath[pairPath.length - 4];

        if (
          isPair(grandPair) &&
          isScalar(grandPair.key) &&
          grandPair.key.value === 'jobs' &&
          typeof pathValue === 'string'
        ) {
          const filePath = path.resolve(basePath, pathValue);
          try {
            const content = await readFile(filePath, 'utf8');
            pair.value.set('content', content);
          } catch (error: any) {
            errors.push({
              path: `job/body/path`,
              context: pair,
              message: `Failed to read file ${pathValue}: ${error.message}`,
              range: pair.value.range,
            });
          }
          return undefined;
        }
      }

      if (pair.key && pair.key.value === 'condition_expression') {
        if (typeof pair.value.value !== 'string') {
          pair.value.value = String(pair.value.value);
        }
      }
    },
  });

  if (!doc.has('name')) {
    errors.push({
      context: doc,
      message: 'Project must have a name',
      path: 'project',
    });
  }

  const workflows = doc.getIn(['workflows']);
  validateWorkflows(workflows);

  // TODO somehow merge or return errors found inside the yamlDoc
  //      or put our own errors in the yamlDoc

  return { errors, doc: doc.toJSON() as ProjectSpec };
}
