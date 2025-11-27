import nodepath from 'path';
import { omit, omitBy } from 'lodash-es';

import { Project } from '../Project';
import { jsonToYaml } from '../util/yaml';
import { extractConfig } from '../util/config';

const stringify = (json: any) => JSON.stringify(json, null, 2);

export default function (project: Project) {
  const files: Record<string, string> = {};

  const { path, content } = extractConfig(project);
  files[path] = content;

  for (const wf of project.workflows) {
    const { path, content } = extractWorkflow(project, wf.id);
    files[path] = content;

    for (const s of wf.steps) {
      const result = extractStep(project, wf.id, s.id!);
      if (result) {
        const { path, content } = result;
        files[path] = content;
      }
    }
  }

  return files;
}

// extracts a workflow.json|yaml from a project
export const extractWorkflow = (project: Project, workflowId: string) => {
  const format = project.config.formats.workflow;

  const workflow = project.getWorkflow(workflowId);
  if (!workflow) {
    throw new Error(`workflow not found: ${workflowId}`);
  }

  const root =
    project.config.dirs.workflows ??
    (project.config as any).workflowRoot ??
    'workflows/';

  const path = nodepath.join(root, workflow.id, workflow.id);

  const wf = {
    id: workflow.id,
    name: workflow.name,
    // Note: if no options are defined, options will serialize to an empty object
    // Not crazy about this - maybe we should do something better? Or do we like the consistency?
    options: workflow.options,
    steps: workflow.steps.map((step) => {
      const { openfn, expression, next, ...mapped } = step;
      if (expression) {
        (mapped as any).expression = `./${step.id}.js`;
      }
      if (next && typeof next === 'object') {
        (mapped as any).next = {};
        for (const id in next) {
          (mapped as any).next[id] = omit(next[id] as any, ['openfn']);
        }
      }
      return mapped;
    }),
  };
  return handleOutput(wf, path, format!);
};

// extracts an expression.js from a workflow in project
export const extractStep = (
  project: Project,
  workflowId: string,
  stepId: string
) => {
  const workflow = project.getWorkflow(workflowId);
  if (!workflow) {
    throw new Error(`workflow not found: ${workflowId}`);
  }
  const step = workflow.steps.find((s) => s.id === stepId);
  if (!step) {
    throw new Error(`step not found: ${stepId}`);
  }

  // TODO unit test needed on this
  if (step.expression) {
    const root =
      project.config?.dirs.workflows ??
      (project.config as any)?.workflowRoot ??
      'workflows/';
    const path = nodepath.join(root, `${workflow.id}/${step.id}.js`);
    const content = step.expression;

    return { path, content };
  }
};

const handleOutput = (data: any, filePath: string, format: 'json' | 'yaml') => {
  const path = `${filePath}.${format}`;
  let content;
  if (format === 'json') {
    content = stringify(data);
  } else if (format === 'yaml') {
    content = jsonToYaml(data);
  } else {
    // TODO not a useful error this
    throw new Error(`Unrecognised format: ${format}`);
  }
  return { path, content };
};
