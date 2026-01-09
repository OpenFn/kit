import type l from '@openfn/lexicon';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pickBy, isNil } from 'lodash-es';
import { yamlToJson, jsonToYaml } from './yaml';
import Project from '../Project';

// Initialize and default Workspace (and Project) config

export const buildConfig = (config: Partial<l.WorkspaceConfig> = {}) => ({
  credentials: 'credentials.yaml',
  ...config,
  dirs: {
    projects: config.dirs?.projects ?? '.projects',
    workflows: config.dirs?.workflows ?? 'workflows',
  },
  formats: {
    openfn: config.formats?.openfn ?? 'yaml',
    project: config.formats?.project ?? 'yaml',
    workflow: config.formats?.workflow ?? 'yaml',
  },
});

// Generate a workspace config (openfn.yaml) file for a project
export const extractConfig = (source: Project) => {
  const project = {
    ...(source.openfn || {}),
    id: source.id,
  };
  const workspace = {
    ...source.config,
  };

  const content = { project, workspace };

  const format = workspace.formats.openfn;
  if (format === 'yaml') {
    return {
      path: 'openfn.yaml',
      content: jsonToYaml(content),
    };
  }
  return {
    path: 'openfn.json',
    content: JSON.stringify(content, null, 2),
  };
};

export const loadWorkspaceFile = (
  contents: string | l.WorkspaceFile | l.WorkspaceFileLegacy,
  format: 'yaml' | 'json' = 'yaml'
) => {
  let project, workspace;
  let json: any = contents;
  if (format === 'yaml') {
    json = yamlToJson(contents as any) ?? {};
  } else if (typeof contents === 'string') {
    json = JSON.parse(contents);
  }

  const legacy = !json.workspace && !json.projects;
  if (legacy) {
    project = json.project ?? {};
    if (json.name) {
      project.name = json.name;
    }

    // prettier-ignore
    const {
      formats,
      dirs,
      project: _ /* ignore!*/,
      name,
      ...rest
    } = json;

    workspace = pickBy(
      {
        ...rest,
        formats,
        dirs,
      },
      (value: unknown) => !isNil(value)
    );
  } else {
    project = json.project ?? {};
    workspace = json.workspace ?? {};
  }

  return { project, workspace };
};

export const findWorkspaceFile = (dir: string = '.') => {
  let content, type;
  try {
    type = 'yaml';
    content = readFileSync(path.resolve(path.join(dir, 'openfn.yaml')), 'utf8');
  } catch (e) {
    // Not found - try and parse as JSON
    try {
      type = 'json';
      const file = readFileSync(path.join(dir, 'openfn.json'), 'utf8');
      if (file) {
        content = JSON.parse(file);
      }
    } catch (e) {
      // console.log(e);
      // TODO better error handling
      throw e;
    }
  }
  return { content, type };
};
