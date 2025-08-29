import { randomUUID } from 'node:crypto';

class WorkflowGenerator {
  ids = new Map<string, string>();
  nodes: Record<string, any> = {};

  uuidSeed;

  constructor(
    def: string[],
    private name: string = 'workflow',
    private uuidSeed
  ) {
    this.uuidSeed = uuidSeed;

    for (const conn of def) {
      const [from, to] = conn.split('-');
      // create node for from and to
      if (this.nodes[from]) {
        if (to && !this.nodes[from].next[to])
          this.nodes[from].next[to] = {
            openfn: { uuid: this.uuid(`${from}-${to}`) },
          };
      } else {
        this.nodes[from] = {
          id: from,
          next: to
            ? { [to]: { openfn: { uuid: this.uuid(`${from}-${to}`) } } }
            : {},
          openfn: { uuid: this.uuid(from) },
        };
      }
      if (to && !this.nodes[to]) {
        this.nodes[to] = {
          id: to,
          next: {},
          openfn: { uuid: this.uuid(to) },
        };
      }
    }
  }

  private uuid(id: string) {
    const muuid = !isNaN(this.uuidSeed) ? ++this.uuidSeed : randomUUID();
    this.ids.set(id, muuid);
    return muuid;
  }

  get workflow() {
    return { name: this.name, steps: Object.values(this.nodes) };
  }

  getId(node: string) {
    return this.ids.get(node);
  }

  setProp(def: string, prop: Record<string, unknown>) {
    const [from, to] = def.split('-');
    if (to) {
      // edge
      if (this.nodes[from]) {
        if (this.nodes[from].next[to])
          this.nodes[from].next[to] = { ...this.nodes[from].next[to], ...prop };
        else this.nodes[from].next[to] = { ...prop };
      }
    } else {
      // node
      if (this.nodes[from]) this.nodes[from] = { ...this.nodes[from], ...prop };
    }
    return this;
  }
}

export default function generateWorkflow(def: string, options = {}) {
  const { name, uuidSeed } = options;

  return new WorkflowGenerator(def, name, uuidSeed);
}
