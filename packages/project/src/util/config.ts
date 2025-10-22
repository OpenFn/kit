// Initiaise and default Workspace (and Project) config

type FileFormats = 'yaml' | 'json';

// This is the old workspace config file, up to 0.6
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

//
export const extractConfig = (source: Project | Workspace) => {};

export const loadCOnfig = (contents: string) => {};
