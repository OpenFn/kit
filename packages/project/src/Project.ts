import * as l from '@openfn/lexicon';
// but what is this ?
// is it just types?

import * as serializers from './serialize';
import fromAppState from './parse/from-app-state';

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
function slugify(text) {
  return text.replace(/\W/g, ' ').trim().replace(/\s+/g, '-');
}

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
  static from(type: 'state' | 'path', data: any, options: any) {
    if (type === 'state') {
      return fromAppState(data, options);
    }
  }

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

  serialize(type: 'json' | 'yaml' | 'fs' | 'state ' = 'json') {
    if (type in serializers) {
      // @ts-ignore
      return serializers[type](this);
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
    const endpoint = this.openfn?.endpoint || 'local';
    const name = this.openfn?.env ?? 'main';
    let host;
    try {
      host = new URL(endpoint).hostname;
    } catch (e) {
      // if an invalid endpoint is passed, assume it's local
      // this may not be fair??
      host = endpoint;
    }
    return `${name}@${host}`;
  }
}

// Surely this is just a type?
class Workflow {}
