import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chain, pickBy, isNil } from 'lodash-es';
import { yamlToJson, jsonToYaml } from './yaml';

// Initialize and default Workspace (and Project) config

type FileFormats = 'yaml' | 'json';

// This is the old workspace config file, up to 0.6
// TODO would like a better name than "Workspace File"
// Can't use config, it means something else (and not all of it is config!)
// State is good but overloaded
// Settings? Context?
export interface WorkspaceFileLegacy {
  workflowRoot: string;
  dirs: {
    workflows: string;
    projects: string;
  };
  formats: {
    openfn: FileFormats;
    project: FileFormats;
    workflow: FileFormats;
  };

  // TODO this isn't actually config - this is other stuff
  name: string;
  project: {
    projectId: string;
    endpoint: string;
    env: string;
    inserted_at: string;
    updated_at: string;
  };
}

// Structure of the new openfn.yaml file
export interface WorkspaceFile {
  workspace: WorkspaceConfig;
  project: ProjectMeta;
}

export interface WorkspaceConfig {
  dirs: {
    workflows: string;
    projects: string;
  };
  formats: {
    openfn: FileFormats;
    project: FileFormats;
    workflow: FileFormats;
  };
}

// TODO this is not implemented yet
export interface ProjectMeta {
  is: string;
  name: string;
  uuid: string;
  endpoint: string;
  env: string;
  inserted_at: string;
  updated_at: string;
}

export const buildConfig = (config: WorkspaceConfig = {}) => ({
  ...config,
  dirs: {
    projects: '.projects', // TODO change to projects
    workflows: 'workflows',
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
  contents: string | WorkspaceFile | WorkspaceFileLegacy,
  format: 'yaml' | 'json' = 'yaml'
) => {
  let project, workspace;
  let json = contents;
  if (format === 'yaml') {
    json = yamlToJson(contents);
  } else if (typeof contents === 'string') {
    json = JSON.parse(contents);
  }

  const legacy = !json.workspace && !json.projects;
  if (legacy) {
    project = json.project;

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
      (value) => !isNil(value)
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
