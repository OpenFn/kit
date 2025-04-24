import * as l from '@openfn/lexicon';
// but what is this ?
// is it just types?

import * as serializers from './serialize';
import fromAppState from './parse/from-app-state';

type MergeOptions = {
  force?: boolean;
  workflows?: string[]; // which workflows to include
};

// // A local collection of openfn projects
// class Repo {

//   projects: {}
// }

// A single openfn project
// could be an app project or a checked out fs
export class Project {
  // what schema version is this?
  // And how are we tracking this?
  // version;

  /** env name - eg prod | staging */
  env?: string;

  /** project name */
  name?: string;
  description?: string;

  // array of version shas
  history: string[] = [];

  workflows: l.Workflow[];

  options: any;

  // This is a bucket of stuff used by the provisioner
  // Things we need to track but don't actually use
  meta: any;

  // this contains meta about the connected openfn project
  openfn?: l.ProjectConfig;

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
  constructor(data: l.Project, env: string) {
    this.name = data.name;
    this.env = env || data.env;
    this.description = data.description;
    this.openfn = data.openfn;
    this.workflows = data.workflows;

    // TODO collections, credentials (or do they just go in the openfn bucket?)
  }

  // serialize to filesystem, json or yaml
  serialize(type: 'json' | 'yaml' | 'fs' = 'json') {
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

  getWorkflow(name: string) {}
}

// Surely this is just a type?
class Workflow {}
