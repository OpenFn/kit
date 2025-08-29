import * as l from '@openfn/lexicon';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

class Workflow {
  workflow;
  index;

  constructor(workflow: l.Workflow) {
    this.index = {
      steps: {}, // steps by id
      edges: {}, // edges by from-id id
      uuid: {}, // id to uuid
      id: {}, // uuid to ids
    };

    this.workflow = clone(workflow);

    const { id, name, openfn, steps, ...options } = workflow;
    this.id = id;
    this.name = name;
    this.openfn = openfn;
    this.options = options;

    this.#buildIndex();
  }

  get steps() {
    return this.workflow.steps;
  }

  #buildIndex() {
    for (const s of this.workflow.steps) {
      // index this step
      this.index.steps[s.id] = s;
      this.index.uuid[s.id] = s.openfn.id;
      if (s.openfn?.id) {
        this.index.id[s.openfn.id] = s.id;
      }

      const edges = s.next ?? {};
      // Now index each edge
      for (const next in edges) {
        const edgeId = `${s.id}-${next}`;
        const edge = edges[next];
        this.index.edges[edgeId] = edge;
        this.index.uuid[edgeId] = edge.openfn?.id;
        if (edge.openfn?.id) {
          this.index.id[edge.openfn.id] = edgeId;
        }
      }
    }
  }

  // Set properties on any step or edge by id
  set(id, props) {
    const item = this.index.edges[id] || this.index.steps[id];
    if (!item) {
      throw new Error(`step/edge with id "${id}" does not exist in workflow`);
    }

    Object.assign(item, props);

    return this;
  }

  // Get properties on any step or edge by id
  get(id) {
    const item = this.index.edges[id] || this.index.steps[id];
    if (!item) {
      throw new Error(`step/edge with id "${id}" does not exist in workflow`);
    }

    return item;
  }

  // Get an edge based on its source and target
  getEdge(from, to) {
    const edgeId = [from, to].join('-');

    const edge = this.index.edges[edgeId];
    if (!edge) {
      throw new Error(`edge with id "${edgeId}" does not exist in workflow`);
    }

    return edge;
  }

  // setStep(id, props) {
  //   // replace the step with id with the properties attached
  //   // create a new step if doesn't exist?
  // }
  // mergeStep(id, props) {
  //   // overwrite each key of props on the step
  //   // throw if the step doesn't exist?
  // }
  // setEdge(from, to, props) {}
  // mergeEdge(from, to, props) {}

  toJSON() {
    return this.workflow;
  }
}

export default Workflow;
