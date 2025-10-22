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
  projectMeta: ProjectMeta;

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
      // invalid workspace
      return;
    }

    this.config = buildConfig(context.workspace);
    this.projectMeta = context.project;

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
          this.projectPaths.set(project.name, stateFilePath);
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

  // TODO clear up name/id confusion
  get(id: string) {
    return this.projects.find((p) => p.name === id);
  }

  getProjectPath(id: string) {
    return this.projectPaths.get(id);
  }

  getActiveProject() {
    // TODO should use id, not name
    return this.projects.find((p) => p.name === this.projectMeta?.name);
  }

  // TODO this needs to return default values
  // We should always rely on the workspace to load these values
  getConfig(): Partial<WorkspaceConfig> {
    return this.config;
  }

  get activeProjectId() {
    // TODO should return activeProject.id
    return this.projectMeta?.name;
  }

  get valid() {
    return this.isValid;
  }
}
