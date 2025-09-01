// serialize the file system

import nodepath from 'path';
import { Project } from '../Project';
import { jsonToYaml } from '../util/yaml';

const stringify = (json) => JSON.stringify(json, null, 2);

export default function (project: Project) {
  const files: Record<string, sting> = {};

  const { path, content } = extractRepoConfig(project);
  files[path] = content;

  for (const wf of project.workflows) {
    const { path, content } = extractWorkflow(project, wf.id);
    files[path] = content;

    for (const s of wf.steps) {
      const result = extractStep(project, wf.id, s.id);
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
  const format = project.repo.formats.workflow;

  const workflow = project.getWorkflow(workflowId);
  if (!workflow) {
    throw new Error(`workflow not found: ${workflowId}`);
  }

  const root = project.repo?.workflowRoot ?? 'workflows/';

  const path = nodepath.join(root, workflow.id, workflow.id);

  const wf = {
    id: workflow.id,
    name: workflow.name,
    // Note: if no options are defined, options will serialize to an empty object
    // Not crazy about this - maybe we should do something better? Or do we like the consistency?
    options: workflow.options,
    steps: workflow.steps.map((step) => {
      const { openfn, expression, ...mapped } = step;
      if (expression) {
        mapped.expression = `./${step.id}.js`;
      }
      return mapped;
    }),
  };
  return handleOutput(wf, path, format);
};

// extracts an expression.js from a workflow in project
export const extractStep = (project: Project, workflowId, stepId) => {
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
    const root = project.config?.workflowRoot ?? 'workflows/';
    const path = nodepath.join(root, `${workflow.id}/${step.id}.js`);
    const content = step.expression;

    return { path, content };
  }
};

// extracts contents for openfn.yaml|json
export const extractRepoConfig = (project) => {
  const format = project.repo.formats.openfn;
  const config = {
    name: project.name,
    ...project.repo,
    project: project.openfn ?? {},
  };

  return handleOutput(config, 'openfn', format);
};

const handleOutput = (data, filePath, format) => {
  const path = `${filePath}.${format}`;
  let content;
  if (format === 'json') {
    content = stringify(data, null, 2);
  } else if (format === 'yaml') {
    content = jsonToYaml(data);
  } else {
    // TODO not a useful error this
    throw new Error(`Unrecognised format: ${format}`);
  }
  return { path, content };
};
