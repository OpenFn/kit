import * as l from '@openfn/lexicon';
// but what is this ?
// is it just types?

import * as serializers from './serialize';
import fromAppState from './parse/from-app-state';

// TODO this naming clearly isn't right
import { parseProject as fromFs } from './parse/from-fs';
import getIdentifier from './util/get-identifier';
import slugify from './util/slugify';
import { getUuidForEdge, getUuidForStep } from './util/uuid';

type MergeOptions = {
  force?: boolean;
  workflows?: string[]; // which workflows to include
};

type FileFormats = 'yaml' | 'json';

// repo-wide options
type RepoOptions = {
  /**default workflow root when serializing to fs (relative to openfn.yaml) */
  workflowRoot?: string;

  formats: {
    openfn: FileFormats;
    workflow: FileFormats;
    project: FileFormats;
  };
};

// // A local collection of openfn projects
// class Repo {

//   projects: {}
// }

// TODO maybe use an npm for this, or create  util

const setConfigDefaults = (config = {}) => ({
  workflowRoot: config.workflowRoot ?? 'workflows',
  formats: {
    // TODO change these maybe
    openfn: config.formats?.openfn ?? 'yaml',
    project: config.formats?.project ?? 'yaml',
    workflow: config.formats?.workflow ?? 'yaml',
  },
});

// A single openfn project
// could be an app project or a checked out fs
export class Project {
  // what schema version is this?
  // And how are we tracking this?
  // version;

  /** project name */
  name?: string;
  description?: string;

  // array of version shas
  history: string[] = [];

  workflows: l.Workflow[];

  // option strings saved by the app
  // these are all (?) unused clientside
  options: any;

  // local metadata used by the CLI
  // This stuff is not synced back to lightning
  meta: any;

  // this contains meta about the connected openfn project
  openfn?: l.ProjectConfig;

  // repo configuration options
  // these should be shared across projects
  // and saved to an openfn.yaml file
  repo?: Required<RepoOptions>;

  // load a project from a state file (project.json)
  // or from a path (the file system)
  // TODO presumably we can detect a state file? Not a big deal?

  static from(
    type: 'state',
    data: any,
    options: Partial<l.ProjectConfig>
  ): Project;
  static from(type: 'fs', options: { root: string }): Project;
  static from(type: 'path', data: any): Project;
  static from(
    type: 'state' | 'path' | 'fs',
    data: any,
    options?: Partial<l.ProjectConfig>
  ): Project {
    if (type === 'state') {
      return fromAppState(data, options);
    }
    if (type === 'fs') {
      return fromFs(data, options);
    }
    throw new Error(`Didn't recognize type ${type}`);
  }

  // Diff two projects
  static diff(a: Project, b: Project) {}

  // env is excluded because it's not really part of the project
  // uh maybe
  // maybe this second arg is config - like env, branch rules, serialisation rules
  // stuff that's external to the actual project and managed by the repo
  constructor(data: l.Project, repoConfig: RepoOptions = {}) {
    this.repo = setConfigDefaults(repoConfig);

    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.openfn = data.openfn;
    this.options = data.options;
    this.workflows = data.workflows;
    this.collections = data.collections;
    this.credentials = data.credentials;
    this.meta = data.meta;
  }

  serialize(type: 'json' | 'yaml' | 'fs' | 'state' = 'json', options?: any) {
    if (type in serializers) {
      // @ts-ignore
      return serializers[type](this, options);
    }
    throw new Error(`Cannot serialize ${type}`);
  }

  // would like a better name for this
  // stamp? id? sha?
  // this builds a version string for the current state
  getVersionHash() {}

  // take a second project and merge its data into this one
  // Throws if there's a conflict, unless force is true
  // It's basically an overwrite
  merge(project: Project, options: any) {}

  // what else might we need?

  // get workflow by name or id
  // this is fuzzy, but is that wrong?
  getWorkflow(id: string) {
    return this.workflows.find((wf) => wf.id == id);
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
}

class Workflow {
  constructor(workflow: l.Workflow) {
    this.steps = {}; // TODO extract from workflow
    this.edges = {}; // TODO extract from workflow

    // maybe the raw model
    this.model = workflow;
  }

  getStep(id) {}
  setStep(id, props) {
    // replace the step with id with the properties attached
    // create a new step if doesn't exist?
  }
  mergeStep(id, props) {
    // overwrite each key of props on the step
    // throw if the step doesn't exist?
  }
  getEdge(from, to) {}
  setEdge(from, to, props) {}
  mergeEdge(from, to, props) {}

  // TODO same for triggers?
  // Or is a trigger just a step?
}
