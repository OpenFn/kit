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
  activeProject?: l.ProjectMeta;

  private projects: Project[] = [];
  private projectPaths = new Map<string, string>();
  private isValid: boolean = false;
  private logger: Logger;

  constructor(workspacePath: string, logger?: Logger) {
    this.logger = logger ?? createLogger('Workspace', { level: 'info' });

    let context = { workspace: undefined, project: undefined };
    try {
      const { type, content } = findWorkspaceFile(workspacePath);
      context = loadWorkspaceFile(content, type as any);
      this.isValid = true;
    } catch (e) {
      this.logger.warn(
        `Could not find openfn.yaml at ${workspacePath}. Using default values.`
      );
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
            // Extract alias from filename
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
      this.logger.warn(
        `No projects found: directory at ${projectsPath} does not exist`
      );
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

  /** Get a project by its alias, id or UUID. Can also include a UUID */
  get(nameyThing: string) {
    return matchProject(nameyThing, this.projects);
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
