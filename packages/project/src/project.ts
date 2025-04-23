import * as l from '@openfn/lexicon';
// but what is this ?
// is it just types?

type MergeOptions = {
  force: boolean;
};

// // A local collection of openfn projects
// class Repo {

//   projects: {}
// }

// A single openfn project
// could be an app project or a checked out fs
export class Project {
  constructor(data: l.Project) {
    this.openfn = data.openfn;
    this.workflows = data.workflows;
  }

  // load a project from a state file (project.json)
  // or from a path (the file system)
  // static from(type: 'state' | 'path', data) {}

  // what schema version is this?
  // And how are we tracking this?
  // version;

  // array of version shas
  history: string[] = [];

  workflows: l.Workflow[];

  options: any;

  // This is a bucket of stuff used by the provisioner
  // Things we need to track but don't actually use
  meta: any;

  // this contains meta about the connected openfn
  openfn?: l.ProjectConfig;

  // serialize to filesystem, or a state file
  serialize() {}

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
