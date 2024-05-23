import YAML, { YAMLMap, isMap, isPair } from 'yaml';
import { ProjectSpec } from './types';

export interface Error {
  context: any;
  message: string;
  path: string; // human readable path to the error (ie, workflow-1/job-2)
  range?: [number, number, number];
}

export function parseAndValidate(input: string): {
  errors: Error[];
  doc: ProjectSpec;
} {
  let errors: Error[] = [];
  const doc = YAML.parseDocument(input);

  function pushUniqueKey(key: string, arr: string[]) {
    if (arr.includes(key)) {
      throw `duplicate key: ${key}`;
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
              pushUniqueKey(jobName, jobKeys);
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
            pushUniqueKey(workflowName, workflowKeys);
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
              message: `workflow '${workflowName}': must be a map`,
              path: 'workflowName',
            });
          }
        }
      }
    } else {
      errors.push({
        context: workflows,
        message: 'workflows: must be a map',
        path: 'workflows',
      });
    }
  }

  YAML.visit(doc, {
    Pair(_, pair: any) {
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
