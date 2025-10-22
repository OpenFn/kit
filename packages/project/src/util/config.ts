import { yamlToJson } from './yaml';
import { chain, pickBy, isNil } from 'lodash-es';

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

// TODO
// Generate a config file from a project
export const extractConfig = (source: Project | Workspace) => {};

export const loadWorkspaceFile = (
  contents: string,
  format: 'yaml' | 'json' = 'yaml'
) => {
  let project, workspace;
  let json;
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

// TODO
// find the workspace file in a specific dir
// throws if it can't find one
export const findWorkspaceFile = (dir: string) => {
  return { content: '', type: '' };
};
