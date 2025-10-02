import { randomUUID } from 'node:crypto';
import Workflow from '../Workflow';
import slugify from '../util/slugify';

function gen(
  def: string[],
  name: string = 'workflow',
  uuidSeed?: number,
  openfnUuid?: boolean
) {
  const ids = new Map<string, string>();
  const nodes: Record<string, any> = {};

  for (const conn of def) {
    const [from, to] = conn.split('-');
    // create node for from and to
    if (nodes[from]) {
      if (to) {
        if (!nodes[from].next?.[to]) {
          nodes[from].next ??= {};
          nodes[from].next[to] = edge(`${from}-${to}`);
        }
      }
    } else {
      let props;
      if (to) {
        props = { next: { [to]: edge(`${from}-${to}`) } };
      }
      nodes[from] = node(from, props);
    }
    if (to && !nodes[to]) {
      nodes[to] = node(to);
    }
  }

  return {
    name: name,
    id: slugify(name),
    steps: Object.values(nodes),
    ...(openfnUuid ? { openfn: { uuid: randomUUID() } } : {}),
  };

  // Generate a node with an openfn.uuid property
  function node(id, props = {}) {
    return {
      id,
      ...props,
      openfn: { uuid: uuid(id) },
    };
  }

  function edge(id, props = {}) {
    return {
      ...props,
      openfn: { uuid: uuid(id) },
    };
  }

  function uuid(id: string) {
    const muuid = !isNaN(uuidSeed) ? ++uuidSeed : randomUUID();
    ids.set(id, muuid);
    return muuid;
  }
}

type GenerateWorkflowOptions = {
  name: string;
  uuidSeed: number;
  openfnUuid: boolean;
};

/**
 * Generate a Workflow from a simple text based representation
 * The def array contains strings of pairs of nodes
 * eg, ['a-b', 'b-c']
 */
export default function generateWorkflow(
  def: string[],
  options: Partial<GenerateWorkflowOptions> = {}
) {
  const { name, uuidSeed, openfnUuid } = options;

  const wf = gen(def, name, uuidSeed, openfnUuid);
  return new Workflow(wf);
}
