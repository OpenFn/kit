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
  loadCheckoutFile,
} from './util/config';
import fromProject from './parse/from-project';
import type { Logger } from '@openfn/logger';
import matchProject from './util/match-project';
import { extractAliasFromFilename } from './parse/from-path';

export type WorkspaceOptions = {
  // The git branch the workspace is on, which determines which checkout file
  // to use. Pass false or null (or leave unset) to use the default checkout
  branch?: string | false | null;
};

export class Workspace {
  // @ts-ignore config not definitely assigned - it sure is
  config: l.WorkspaceConfig;

  // TODO activeProject should be the actual project
  activeProject?: l.ProjectMeta;

  root: string;

  branch?: string | false | null;

  private projects: Project[] = [];
  private projectPaths = new Map<Project, string>();
  private isValid: boolean = false;
  private logger: Logger;

  // Set validate to false to suppress warnings if a Workspace doesn't exist
  // This is appropriate if, say, fetching a project for the first time
  constructor(
    workspacePath: string,
    logger?: Logger,
    validate = true,
    options: WorkspaceOptions = {}
  ) {
    this.root = workspacePath;
    this.branch = options.branch;
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

    // TODO: work out the alias of the active project
    //       and make sure it's written
    // tbh as activeProject is just the metadata in openfn.yaml,
    // it's not super reliable
    // Actually would it not be better to find the ACTUAL project and just
    // reference that?
    this.activeProject = loadCheckoutFile(
      workspacePath,
      this.branch,
      context.project
    );

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
            this.projectPaths.set(project, stateFilePath);
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

  getProjectPath(project: Project) {
    return this.projectPaths.get(project);
  }

  /**
   * Find the local copy of the checked-out project.
   *
   * Several local copies can share a uuid and id (eg main@app.openfn.org and
   * staging@localhost), so the checkout's alias and endpoint are tried first.
   * Older checkouts may not record an alias: fall back to uuid, then id.
   */
  getTrackedProject() {
    const { alias, endpoint, uuid, id } = this.activeProject ?? {};

    if (alias) {
      const match = this.projects.find(
        (p) =>
          p.alias === alias &&
          (!endpoint || sameOrigin(p.openfn?.endpoint, endpoint as string))
      );
      if (match) return match;
    }

    if (uuid) {
      const match = this.projects.find((p) => p.openfn?.uuid === uuid);
      if (match) return match;
    }

    return this.projects.find((p) => p.id === id);
  }

  async getCheckedOutProject(alias?: string | null) {
    return await Project.from('fs', {
      root: this.root,
      config: this.config,
      branch: this.branch,
      // The checked out project can't meaningfully be said to have an alias
      // But we can force one if it makes sense from context
      alias: alias ?? null,
    }).catch((e) => {
      if (e.code === 'ENOENT') return undefined;
      throw e;
    });
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

// Compare origins rather than hostnames so that ports count
// (localhost:4000 and localhost:5000 are different servers)
const sameOrigin = (a?: string, b?: string) =>
  !!a && !!b && new URL(a).origin === new URL(b).origin;
