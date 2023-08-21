import YAML, { YAMLMap, isMap, isPair } from 'yaml';
import { ProjectSpec } from './types';

export interface Error {
  context: any;
  message: string;
  path?: string[];
  range?: [number, number, number];
}

export function parseAndValidate(input: string): {
  errors: Error[];
  doc: ProjectSpec;
} {
  let errors: Error[] = [];
  let keys: string[] = [];
  const doc = YAML.parseDocument(input);

  function pushUniqueKey(context: YAML.Pair, key: string) {
    if (keys.includes(key)) {
      errors.push({
        context,
        message: `duplicate key: ${key}`,
      });
    } else {
      keys.push(key);
    }
  }

  function validateJobs(workflow: YAMLMap) {
    const jobs = workflow.getIn(['jobs']);

    if (jobs) {
      if (isMap(jobs)) {
        for (const job of jobs.items) {
          if (isPair(job)) {
            pushUniqueKey(job, (job as any).key.value);
          }
        }
      } else {
        errors.push({
          context: jobs,
          message: 'jobs: must be a map',
        });
      }
    }
  }

  function validateWorkflows(workflows: any) {
    if (isMap(workflows)) {
      for (const workflow of workflows.items) {
        if (isPair(workflow)) {
          pushUniqueKey(workflow, (workflow as any).key.value);

          validateJobs((workflow as any).value);
        }
      }
    } else {
      errors.push({
        context: workflows,
        message: 'workflows: must be a map',
        path: ['workflows'],
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
            path: ['workflows'],
          });

          return doc.createPair('workflows', {});
        }
      }

      if (pair.key && pair.key.value === 'jobs') {
        if (pair.value.value === null) {
          errors.push({
            context: pair,
            message: 'jobs: must be a map',
            range: pair.value.range,
          });

          return doc.createPair('jobs', {});
        }
      }
    },
  });

  if (!doc.has('name')) {
    errors.push({ context: doc, message: 'Project must have a name' });
  }

  const workflows = doc.getIn(['workflows']);
  validateWorkflows(workflows);

  // TODO somehow merge or return errors found inside the yamlDoc
  //      or put our own errors in the yamlDoc

  return { errors, doc: doc.toJSON() as ProjectSpec };
}
