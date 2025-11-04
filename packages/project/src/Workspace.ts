import path from 'node:path';
import fs from 'node:fs';

import { Project } from './Project';
import type { WorkspaceConfig } from './util/config';
import fromAppState from './parse/from-app-state';
import pathExists from './util/path-exists';
import { yamlToJson } from './util/yaml';
import {
  buildConfig,
  loadWorkspaceFile,
  findWorkspaceFile,
} from './util/config';

const PROJECT_EXTENSIONS = ['.yaml', '.yml'];

export class Workspace {
  config?: WorkspaceConfig;
  activeProject: ProjectMeta;

  private projects: Project[] = [];
  private projectPaths = new Map<string, string>();
  private isValid: boolean = false;

  constructor(workspacePath: string) {
    let context;
    try {
      const { type, content } = findWorkspaceFile(workspacePath);
      context = loadWorkspaceFile(content, type);
      this.isValid = true;
    } catch (e) {
      console.error(e);
      // invalid workspace
      return;
    }
    this.config = buildConfig(context.workspace);
    this.activeProject = context.project;

    const projectsPath = path.join(workspacePath, this.config.dirs.projects);

    // dealing with projects
    if (this.isValid && pathExists(projectsPath, 'directory')) {
      const stateFiles = fs
        .readdirSync(projectsPath)
        .filter(
          (fileName) =>
            PROJECT_EXTENSIONS.includes(path.extname(fileName)) &&
            path.parse(fileName).name !== 'openfn'
        );

      this.projects = stateFiles
        .map((file) => {
          const stateFilePath = path.join(projectsPath, file);
          const data = fs.readFileSync(stateFilePath, 'utf-8');
          const project = fromAppState(data, { format: 'yaml' });
          console.log({ project });
          this.projectPaths.set(project.id, stateFilePath);
          return project;
        })
        .filter((s) => s);
    }
  }

  // TODO
  // This will load a project within this workspace
  // uses Project.from
  // Rather than doing new Workspace + Project.from(),
  // you can do it in a single call
  loadProject() {}

  list() {
    return this.projects;
  }

  /** Get a project by its id or UUID */
  get(id: string) {
    return (
      this.projects.find((p) => p.id === id) ??
      this.projects.find((p) => p.openfn?.uuid === id)
    );
  }

  getProjectPath(id: string) {
    return this.projectPaths.get(id);
  }

  getActiveProject() {
    return (
      this.projects.find((p) => p.id === this.activeProject?.id) ??
      this.projects.find((p) => p.openfn?.uuid === this.activeProject?.uuid)
    );
  }

  // TODO this needs to return default values
  // We should always rely on the workspace to load these values
  getConfig(): Partial<WorkspaceConfig> {
    return this.config;
  }

  get activeProjectId() {
    return this.activeProject?.id;
  }

  get valid() {
    return this.isValid;
  }
}
