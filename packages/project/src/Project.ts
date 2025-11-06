import type l from '@openfn/lexicon';
import { humanId } from 'human-id';
import Workflow from './Workflow';
import * as serializers from './serialize';
import fromAppState, { fromAppStateConfig } from './parse/from-app-state';
import fromPath, { FromPathConfig } from './parse/from-path';
// TODO this naming clearly isn't right
import { parseProject as fromFs, FromFsConfig } from './parse/from-fs';
import getIdentifier from './util/get-identifier';
import slugify from './util/slugify';
import { getUuidForEdge, getUuidForStep } from './util/uuid';
import { merge, MergeProjectOptions } from './merge/merge-project';
import { Workspace } from './Workspace';
import { buildConfig } from './util/config';
import { Provisioner } from '@openfn/lexicon/lightning';
import { UUID, WorkspaceConfig } from '@openfn/lexicon';

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

  // local metadata used by the CLI
  // This stuff is not synced back to lightning
  meta: any;

  // this contains meta about the connected openfn project
  openfn?: l.ProjectMeta;

  workspace?: Workspace;

  config: l.WorkspaceConfig;

  collections: any;

  credentials: string[];

  static from(
    type: 'state',
    data: Provisioner.Project,
    meta: Partial<l.ProjectMeta>,
    config: fromAppStateConfig
  ): Project;
  static from(type: 'fs', options: FromFsConfig): Project;
  static from(
    type: 'path',
    data: string,
    options?: { config?: FromPathConfig }
  ): Project;
  static from(
    type: 'state' | 'path' | 'fs',
    data: any,
    ...rest: any[]
  ): Project {
    if (type === 'state') {
      return fromAppState(data, rest[0], rest[1]);
    } else if (type === 'fs') {
      return fromFs(data, rest[0]);
    } else if (type === 'path') {
      return fromPath(data, rest[0]);
    }
    throw new Error(`Didn't recognize type ${type}`);
  }

  // Diff two projects
  static diff(a: Project, b: Project) {}

  // Merge a source project (staging) into the target project (main)
  // Returns a new Project
  // TODO: throw if histories have diverged
  static merge(source: Project, target: Project, options: MergeProjectOptions) {
    return merge(source, target, options);
  }

  // env is excluded because it's not really part of the project
  // uh maybe
  // maybe this second arg is config - like env, branch rules, serialisation rules
  // stuff that's external to the actual project and managed by the repo

  // TODO maybe the constructor is (data, Workspace)
  constructor(data: Partial<l.Project>, config?: Partial<l.WorkspaceConfig>) {
    this.config = buildConfig(config);

    this.id =
      data.id ??
      (data.name
        ? slugify(data.name)
        : humanId({ separator: '-', capitalize: false }));

    this.name = data.name;

    this.description = data.description ?? undefined;
    this.openfn = data.openfn as l.ProjectMeta; // TODO shaky typing here tbh
    this.options = data.options;
    this.workflows = data.workflows?.map(maybeCreateWorkflow) ?? [];
    this.collections = data.collections;
    this.credentials = data.credentials;
    // this.meta = data.meta ?? {};
  }

  setConfig(config: Partial<WorkspaceConfig>) {
    this.config = buildConfig(config);
  }

  serialize(type: 'json' | 'yaml' | 'fs' | 'state' = 'json', options?: any) {
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

  // it's the name of the project.yaml file
  // qualified name? Remote name? App name?
  // every project in a repo need a unique identifier
  getIdentifier() {
    return getIdentifier(this.openfn);
  }

  // Compare this project with another and return a diff
  compare(proj: Project) {}

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
}

export default Project;
