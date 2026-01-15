import type l from '@openfn/lexicon';
import { humanId } from 'human-id';
import Workflow from './Workflow';
import * as serializers from './serialize';
import fromAppState, { fromAppStateConfig } from './parse/from-app-state';
import fromPath, { FromPathConfig } from './parse/from-path';
// TODO this naming clearly isn't right
import { parseProject as fromFs, FromFsConfig } from './parse/from-fs';
import fromProject, { SerializedProject } from './parse/from-project';
import slugify from './util/slugify';
import { getUuidForEdge, getUuidForStep } from './util/uuid';
import { merge, MergeProjectOptions } from './merge/merge-project';
import { diff as projectDiff } from './util/project-diff';
import { Workspace } from './Workspace';
import { buildConfig } from './util/config';
import { Provisioner } from '@openfn/lexicon/lightning';
import { SandboxMeta, UUID, WorkspaceConfig } from '@openfn/lexicon';

const maybeCreateWorkflow = (wf: any) =>
  wf instanceof Workflow ? wf : new Workflow(wf);

type UUIDMap = {
  [workflowId: string]: {
    self?: UUID;
    children: {
      [nodeId: string]: UUID;
    };
  };
};

type CLIMeta = {
  version?: number;
  alias?: string;
};

export class Project {
  // what schema version is this?
  // And how are we tracking this?
  // version;

  /** Human readable project name. This corresponds to the label in Lightning */
  name?: string;

  /** Project id. Must be url safe. May be derived from the name. NOT a UUID */
  id: string;

  description?: string;

  // array of version hashes
  history: string[] = [];

  workflows: Workflow[];

  // option strings saved by the app
  // these are all (?) unused clientside
  options: any;

  /**
   * Local metadata used by the CLI but not synced to Lightning
   */
  cli: CLIMeta;

  // this contains meta about the connected openfn project
  openfn?: l.ProjectMeta;

  workspace?: Workspace;

  config: l.WorkspaceConfig;

  collections: any;

  credentials: string[];

  sandbox?: SandboxMeta;

  // project v2. Default.
  // doens't take any options
  static async from(
    type: 'project',
    data: any,
    options: never
  ): Promise<Project>;
  static async from(
    type: 'state',
    data: Provisioner.Project,
    meta?: Partial<l.ProjectMeta>,
    config?: fromAppStateConfig
  ): Promise<Project>;
  static async from(type: 'fs', options: FromFsConfig): Promise<Project>;
  static async from(
    type: 'path',
    data: string,
    options?: { config?: FromPathConfig }
  ): Promise<Project>;
  static async from(
    type: 'project' | 'state' | 'path' | 'fs',
    data: any,
    ...rest: any[]
  ): Promise<Project> {
    switch (type) {
      case 'project':
        var [config] = rest;
        return fromProject(data, config);
      case 'state':
        return fromAppState(data, rest[0], rest[1]);
      case 'fs':
        return fromFs(data);
      case 'path':
        var [config] = rest;
        return fromPath(data, config);
      default:
        throw new Error(`Didn't recognize type ${type}`);
    }
  }

  // Diff two projects
  // static diff(a: Project, b: Project) {}

  // Merge a source project (staging) into the target project (main)
  // Returns a new Project
  // TODO: throw if histories have diverged
  static merge(
    source: Project,
    target: Project,
    options?: Partial<MergeProjectOptions>
  ) {
    return merge(source, target, options);
  }

  // TODO maybe the constructor is (data, Workspace)
  constructor(
    data: Partial<l.Project> = {},
    meta?: Partial<l.WorkspaceConfig> & CLIMeta
  ) {
    this.id =
      data.id ??
      (data.name
        ? slugify(data.name)
        : humanId({ separator: '-', capitalize: false }));

    const { version, alias = 'main', ...otherConfig } = meta ?? {};
    this.cli = Object.assign(
      {
        alias,
      },
      data.cli
    );

    this.config = buildConfig(otherConfig);

    this.name = data.name;

    this.description = data.description ?? undefined;
    this.openfn = data.openfn as l.ProjectMeta; // TODO shaky typing here tbh
    this.options = data.options;
    this.workflows = data.workflows?.map(maybeCreateWorkflow) ?? [];
    this.collections = data.collections;
    this.credentials = data.credentials;
    this.sandbox = data.sandbox;
  }

  /** Local alias for the project. Comes from the file name. Not shared with Lightning. */
  get alias() {
    return this.cli.alias ?? 'main';
  }

  get uuid() {
    return this.openfn?.uuid ? `${this.openfn.uuid}` : undefined;
  }

  // Helper to extract hostname from endpoint
  get host() {
    const { endpoint } = this.openfn ?? {};
    if (endpoint) {
      return new URL(endpoint).hostname;
    }
  }

  setConfig(config: Partial<WorkspaceConfig>) {
    this.config = buildConfig(config);
  }

  serialize(type: 'project', options?: any): SerializedProject | string;
  serialize(type: 'state', options?: any): Provisioner.Project | string;
  serialize(type: 'fs', options?: any): Record<string, string>;
  serialize(type: 'project' | 'fs' | 'state' = 'project', options?: any) {
    if (type in serializers) {
      // @ts-ignore
      return serializers[type](this, options);
    }
    throw new Error(`Cannot serialize ${type}`);
  }

  // get workflow by name, id or uuid
  getWorkflow(idOrName: string) {
    return (
      this.workflows.find((wf) => wf.id == idOrName) ||
      this.workflows.find((wf) => wf.name === idOrName) ||
      this.workflows.find((wf) => wf.openfn?.uuid === idOrName)
    );
  }

  /** Returns a fully qualified name for the project, id, alias@domain */
  get qname() {
    const { alias, host } = this;
    if (host) {
      return `${alias}@${host}`;
    }
    return alias;
  }

  // Compare this project with another and return a diff
  // compare(proj: Project) {}

  // find the UUID for a given node or edge
  // returns null if it doesn't exist
  getUUID(workflow: string | Workflow, stepId: string, otherStep?: string) {
    if (otherStep) {
      return getUuidForEdge(this, workflow, stepId, otherStep);
    }
    return getUuidForStep(this, workflow, stepId);
  }

  /**
   * Returns a map of ids:uuids for everything in the project
   */
  getUUIDMap(): UUIDMap {
    const result: UUIDMap = {};
    for (const wf of this.workflows) {
      result[wf.id] = {
        self: wf.openfn?.uuid,
        children: wf.getUUIDMap(),
      };
    }
    return result;
  }

  // Compare this project with another and return a list of workflow changes
  diff(project: Project) {
    return projectDiff(this, project);
  }

  canMergeInto(target: Project) {
    const potentialConflicts: Record<string, string> = {};
    for (const sourceWorkflow of this.workflows) {
      // TODO mapping needs work
      const targetId = sourceWorkflow.id;
      const targetWorkflow = target.getWorkflow(targetId);
      if (targetWorkflow && !sourceWorkflow.canMergeInto(targetWorkflow)) {
        potentialConflicts[sourceWorkflow.id] = targetWorkflow?.id;
      }
    }
    if (Object.keys(potentialConflicts).length) {
      return false;
    }
    return true;
  }
}

export default Project;
