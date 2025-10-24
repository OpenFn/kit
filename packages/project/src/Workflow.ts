import * as l from '@openfn/lexicon';
import slugify from './util/slugify';
import { generateHash } from './util/version';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

type OpenfnMeta = {
  uuid?: string;
};

type WithMeta<T> = T & {
  openfn?: OpenfnMeta;
};

class Workflow {
  workflow: l.Workflow; // this is the raw workflow JSON representation
  index;

  name?: string;
  id: string;
  openfn: OpenfnMeta;

  constructor(workflow: l.Workflow) {
    this.index = {
      steps: {}, // steps by id
      edges: {}, // edges by from-id id
      uuid: {}, // id to uuid
      id: {}, // uuid to ids
    };

    this.workflow = clone(workflow);

    // history needs to be on workflow object.
    this.workflow.history = workflow.history?.length ? workflow.history : [];

    const { id, name, openfn, steps, ...options } = workflow;
    if (!(id || name)) {
      throw new Error('A Workflow MUST have a name or id');
    }

    this.id = id ?? slugify(name);
    this.name = name;

    // This is a bit messy but needed to allow toJSON() to serialize properly
    this.workflow.id = this.id;
    if (name) {
      this.workflow.name = this.name;
    }

    this.openfn = openfn;
    this.options = options;

    this.#buildIndex();
  }

  get steps(): WithMeta<l.Job | l.Trigger>[] {
    return this.workflow.steps;
  }

  #buildIndex() {
    for (const s of this.workflow.steps) {
      // index this step
      this.index.steps[s.id] = s;
      this.index.uuid[s.id] = s.openfn?.uuid;
      if (s.openfn?.uuid) {
        this.index.id[s.openfn.uuid] = s.id;
      }

      const edges = s.next ?? {};
      // Now index each edge
      for (const next in edges) {
        const edgeId = `${s.id}-${next}`;
        const edge = edges[next];
        this.index.edges[edgeId] = edge;
        this.index.uuid[edgeId] = edge.openfn?.uuid;
        if (edge.openfn?.uuid) {
          this.index.id[edge.openfn.uuid] = edgeId;
        }
      }
    }
  }

  // Set properties on any step or edge by id
  set(id: string, props: Parital<l.Job, l.Edge>) {
    const item = this.index.edges[id] || this.index.steps[id];
    if (!item) {
      throw new Error(`step/edge with id "${id}" does not exist in workflow`);
    }

    Object.assign(item, props);

    return this;
  }

  // Get properties on any step or edge by id
  get(id): WithMeta<l.Step | l.Trigger | l.Edge> {
    const item = this.index.edges[id] || this.index.steps[id];
    if (!item) {
      throw new Error(`step/edge with id "${id}" does not exist in workflow`);
    }

    return item;
  }

  // TODO needs unit tests and maybe setter
  meta(id): OpenfnMeta {
    const item = this.index.edges[id] || this.index.steps[id];
    if (!item) {
      throw new Error(`step/edge with id "${id}" does not exist in workflow`);
    }

    return item.openfn ?? {};
  }

  // Get an edge based on its source and target
  getEdge(from, to): WithMeta<l.ConditionalStepEdge> {
    const edgeId = [from, to].join('-');

    const edge = this.index.edges[edgeId];
    if (!edge) {
      throw new Error(`edge with id "${edgeId}" does not exist in workflow`);
    }

    return edge;
  }

  getAllEdges() {
    const edges: Record<string, string[]> = {};
    for (const step of this.steps) {
      const next =
        typeof step.next === 'string' ? { [step.next]: true } : step.next || {};

      for (const toNode of Object.keys(next)) {
        if (!Array.isArray(edges[step.id])) edges[step.id] = [toNode];
        else edges[step.id].push(toNode);
      }
    }
    return edges;
  }

  getStep(id: string) {
    return this.index.steps[id] as Workflow['steps'][number];
  }

  getRoot() {
    const edges = this.getAllEdges();
    const all_children = [];
    const all_parents = [];
    for (const [parent, children] of Object.entries(edges)) {
      all_children.push(...children);
      all_parents.push(parent);
    }
    const root = all_parents.find((parent) => !all_children.includes(parent));
    if (!root) return;
    return this.index.steps[root] as Workflow['steps'][number];
  }

  getUUID(id): string {
    return this.index.uuid[id];
  }

  toJSON(): JSON.Object {
    return this.workflow;
  }

  getUUIDMap(): Record<string, string> {
    return this.index.uuid;
  }

  getVersionHash() {
    return generateHash(this);
  }

  pushHistory(versionHash: string) {
    this.workflow.history?.push(versionHash);
  }

  // return true if the current workflow can be merged into the target workflow without losing any changes
  canMergeInto(target: Workflow) {
    const thisHistory = this.workflow.history?.concat(this.getVersionHash());
    const targetHistory = target.workflow.history?.concat(
      target.getVersionHash()
    );

    const targetHead = targetHistory[targetHistory.length - 1];
    if (thisHistory.indexOf(targetHead) > -1) return true;
    return false;
  }
}

export default Workflow;
