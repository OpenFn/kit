import { randomUUID } from 'node:crypto';

const uuid = randomUUID;

class WorkflowGenerator {
  ids = new Map<string, string>();
  nodes: Record<string, any> = {};
  constructor(def: string[], private name: string = 'workflow') {
    for (const conn of def) {
      const [from, to] = conn.split('-');
      // create node for from and to
      if (this.nodes[from]) {
        if (to) this.nodes[from].next[to] = true;
      } else {
        const fromId = uuid();
        this.ids.set(from, fromId);
        this.nodes[from] = {
          id: from,
          openfn: { id: fromId },
          next: to ? {} : { [to]: true },
        };
      }
      if (to && !this.nodes[to]) {
        const toId = uuid();
        this.ids.set(to, toId);
        this.nodes[to] = {
          id: to,
          openfn: { id: toId },
          next: {},
        };
      }
    }
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

export default function generateWorkflow(def: string, name?: string) {
  return new WorkflowGenerator(def, name);
}
