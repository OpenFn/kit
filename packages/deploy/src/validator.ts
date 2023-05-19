import YAML, { YAMLMap, isMap, isPair } from 'yaml';
import { Project } from './types';
import { uuidRegex } from './utils';

function isUUID(_schema, data) {
  return uuidRegex.test(data);
}

interface Error {
  context: any;
  message: string;
  path?: string[];
}

export function validate(input: string): { errors: Error[]; doc: Project } {
  let errors = [];
  let keys: string[] = [];
  const doc = YAML.parseDocument(input);

  function pushUniqueKey(context: YAML.Pair<unknown, unknown>, key: string) {
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
            pushUniqueKey(job, job.key.value);
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

  function validateWorkflows(workflows: unknown) {
    if (isMap(workflows)) {
      for (const workflow of workflows.items) {
        if (isPair(workflow)) {
          pushUniqueKey(workflow, workflow.key.value);

          validateJobs(workflow.value);
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

  if (!doc.has('name')) {
    errors.push({ context: doc, message: 'Project must have a name' });
  }

  // console.log(doc);

  const workflows = doc.getIn(['workflows']);
  validateWorkflows(workflows);

  // TODO somehow merge or return errors found inside the yamlDoc
  //      or put our own errors in the yamlDoc

  return { errors, doc: doc.toJSON() as Project };
}
