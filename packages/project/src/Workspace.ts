import * as l from '@openfn/lexicon';
import createLogger from '@openfn/logger';
import path from 'node:path';
import fs from 'node:fs';

import { Project } from './Project';
import pathExists from './util/path-exists';
import {
  buildConfig,
  loadWorkspaceFile,
  findWorkspaceFile,
} from './util/config';
import fromProject from './parse/from-project';
import type { Logger } from '@openfn/logger';
import matchProject from './util/match-project';
import { extractAliasFromFilename } from './parse/from-path';

export class Workspace {
  // @ts-ignore config not definitely assigned - it sure is
  config: l.WorkspaceConfig;

  // TODO activeProject should be the actual project
  activeProject?: l.ProjectMeta;

  root: string;

  private projects: Project[] = [];
  private projectPaths = new Map<string, string>();
  private isValid: boolean = false;
  private logger: Logger;

  // Set validate to false to suppress warnings if a Workspace doesn't exist
  // This is appropriate if, say, fetching a project for the first time
  constructor(workspacePath: string, logger?: Logger, validate = true) {
    this.root = workspacePath;
    this.logger = logger ?? createLogger('Workspace', { level: 'info' });

    let context = { workspace: undefined, project: undefined };
    try {
      const { type, content } = findWorkspaceFile(workspacePath);
      context = loadWorkspaceFile(content, type as any);
      this.isValid = true;
    } catch (e) {
      if (validate) {
        this.logger.warn(
          `Could not find openfn.yaml at ${workspacePath}. Using default configuration.`
        );
      }
    }
    this.config = buildConfig(context.workspace);
    this.activeProject = context.project;

    const projectsPath = path.join(workspacePath, this.config.dirs.projects);
    // dealing with projects
    if (pathExists(projectsPath, 'directory')) {
      const ext = `.${this.config.formats.project}`;
      const stateFiles = fs
        .readdirSync(projectsPath)
        .filter(
          (fileName) =>
            path.extname(fileName) === ext &&
            path.parse(fileName).name !== 'openfn'
        );
      this.projects = stateFiles
        .map((file) => {
          const stateFilePath = path.join(projectsPath, file);
          try {
            const data = fs.readFileSync(stateFilePath, 'utf-8');
            const alias = extractAliasFromFilename(file);
            const project = fromProject(data, {
              ...this.config,
              alias,
            });
            this.projectPaths.set(project.id, stateFilePath);
            return project;
          } catch (e) {
            console.warn(`Failed to load project from ${stateFilePath}`);
            console.warn(e);
          }
        })
        .filter((s) => s) as Project[];
    } else {
      if (validate) {
        this.logger.warn(
          `No projects found: directory at ${projectsPath} does not exist`
        );
      }
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

  get projectsPath() {
    return path.join(this.root, this.config.dirs.projects);
  }

  get workflowsPath() {
    return path.join(this.root, this.config.dirs.workflows);
  }

  /** Get a project by its alias, id or UUID. Can also include a UUID */
  get(nameyThing: string) {
    return matchProject(nameyThing, this.projects);
  }

  getProjectPath(id: string) {
    return this.projectPaths.get(id);
  }

  getActiveProject() {
    return (
      this.projects.find((p) => p.openfn?.uuid === this.activeProject?.uuid) ??
      this.projects.find((p) => p.id === this.activeProject?.id)
    );
  }

  getCheckedOutProject() {
    return Project.from('fs', { root: this.root, config: this.config });
  }

  getCredentialMap() {
    return this.config.credentials;
  }

  // TODO this needs to return default values
  // We should always rely on the workspace to load these values
  getConfig(): Partial<l.WorkspaceConfig> {
    return this.config!;
  }

  get activeProjectId() {
    return this.activeProject?.id;
  }

  get valid() {
    return this.isValid;
  }
}
