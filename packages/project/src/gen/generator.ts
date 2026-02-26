import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { grammar } from 'ohm-js';
import { isNil, set } from 'lodash-es';
import Project from '../Project';
import Workflow from '../Workflow';
import slugify from '../util/slugify';

type GenerateWorkflowOptions = {
  name: string;
  uuidSeed: number;
  printErrors: boolean; // true by default

  // Optional map of uuids to use for each node id
  // useful to generate a project with fixed ids
  uuidMap?: Record<string, string>;

  openfnUuid: boolean; // TODO probably need to do this by default?

  /** If true, will set up a version hash in the history array */
  history: boolean;
};

type GenerateProjectOptions = GenerateWorkflowOptions & {
  uuidMap: Array<Record<string, string>>;
  uuid?: string | number;
};

let parser: {
  parse(str: string, options: Partial<GenerateWorkflowOptions>): Workflow;
};

const expectedNodeProps = [
  // TODO need to clarify adaptor/adaptors confusion
  'adaptor',
  'adaptors',
  'configuration',
  'expression',
  'condition',
  'label',
  'type',
  'disabled',
  'name',
];

const initOperations = (options: any = {}) => {
  let nodes: any = {};
  const uuidMap = options.uuidMap ?? {};

  // Sets values available to this inside semantic actions
  const uuid = (id: string) => {
    if (id in uuidMap) {
      return uuidMap[id];
    }
    return options.uuidSeed ? options.uuidSeed++ : randomUUID();
  };

  const buildNode = (name: string) => {
    if (!nodes[name]) {
      const id = slugify(name);
      nodes[name] = {
        id,
      };
      if (/^(cron|webhook)$/.test(name)) {
        // This sets up the node as a trigger
        nodes[name].type = name;
      } else {
        nodes[name].name = name;
      }
      if (options.openfnUuid !== false) {
        nodes[name].openfn = {
          uuid: uuid(id),
        };
      }
    }
    return nodes[name];
  };

  // These are functions which run on matched parse trees
  // TODO typings ought to be fixed - use NonterminalNode and TerminalNode from Ohm
  const operations = {
    Workflow(attrs: any, pair: any) {
      pair.children.forEach((child: any) => child.buildWorkflow());

      const steps = Object.values(nodes);

      const attributes = attrs.children
        .map((c: any) => c.buildWorkflow())
        .reduce((obj: any, next: any) => {
          const [key, value] = next;
          set(obj, key, value);
          return obj;
        }, {});

      return { ...attributes, steps: steps };
    },
    comment(_a: any, _b: any) {
      return null;
    },
    attribute(_: unknown, name: any, _space: unknown, value: any) {
      return [
        name.sourceString,
        value.isTerminal() ? value.sourceString : value.buildWorkflow(),
      ];
    },
    attr_value(n: any) {
      return n.isTerminal() ? n.sourceString : n.buildWorkflow();
    },
    bool(value: any) {
      return value.sourceString === 'true';
    },
    int(value: any) {
      return parseInt(value.sourceString);
    },
    Pair(parent: any, edge: any, child: any) {
      const n1 = parent.buildWorkflow();
      const n2 = child.buildWorkflow();
      const e = edge.buildWorkflow();

      if (options.openfnUuid !== false) {
        e.openfn.uuid = uuid(`${n1.id}-${n2.id}`);
      }

      n1.next ??= {};

      n1.next[n2.id ?? slugify(n2.name)] = e;

      return [n1, n2];
    },
    // node could just be a node name, or a node with props
    // different results have different requirements
    // Not sure the best way to handle this, but this seems to work
    node(node: any) {
      if (node._node.ruleName === 'node_name') {
        return buildNode(node.sourceString);
      }
      return node.buildWorkflow();
    },
    nodeWithProps(nameNode: any, props: any) {
      const name = nameNode.sourceString;
      const node = buildNode(name);
      props.buildWorkflow().forEach(([key, value]: any) => {
        if (expectedNodeProps.includes(key)) {
          nodes[name][key] = value;
        } else {
          nodes[name].openfn ??= {};
          nodes[name].openfn[key] = value;
        }
      });
      return node;
    },
    node_name(n: any) {
      return n.sourceString;
    },
    props(_lbr: any, props: any, _rbr: any) {
      return props.asIteration().children.map((c: any) => c.buildWorkflow());
    },
    prop(key: any, _op: any, value: any) {
      return [key.sourceString, value.buildWorkflow()];
    },
    // Bit flaky - we need this to handle quoted props
    _iter(...items: any) {
      return items
        .map((i: any) => (i.isTerminal() ? i.sourceString : i.buildWorkflow()))
        .join('');
    },
    alnum(a: any) {
      return a.sourceString;
    },
    quoted_prop(_left: any, value: any, _right: any) {
      return value.sourceString;
    },
    edge(_: any) {
      return {
        openfn: {},
      };
    },
    edge_with_props(_: any, props: any, __: any) {
      const edge = {
        openfn: {},
      };

      props.buildWorkflow().forEach(([key, value]: any) => {
        // @ts-ignore
        edge[key] = value;
      });

      return edge;
    },
  };

  return operations;
};

export const createParser = () => {
  // Load the grammar
  // TODO: is there any way I can compile/serialize the grammar into JS?
  // @ts-expect-error
  const grammarPath = path.resolve(import.meta.dirname, 'workflow.ohm');
  const contents = readFileSync(grammarPath, 'utf-8');
  const parser = grammar(contents);

  return {
    parse(str: string, options: Partial<GenerateWorkflowOptions>) {
      const { printErrors = true } = options;

      // Setup semantic actions (which run against an AST and build stuff)
      // Do this on each parse so we can maintain state
      const semantics = parser.createSemantics();

      semantics.addOperation('buildWorkflow', initOperations(options));

      // First we parse the source
      const result = parser.match(str);
      if (!result.succeeded()) {
        if (printErrors) {
          console.error(result.shortMessage);
          console.error(result.message);
        }
        // TODO can we be more helpful here?
        throw new Error('Parsing failed!' + result.shortMessage);
      }

      // Then we pass the AST into an operation factory
      const adaptor = semantics(result);

      // Finally we trigger a semantic action to build a workflow
      return adaptor.buildWorkflow();
    },
  };
};

/**
 * Generate a Workflow from a simple text based representation
 * eg, `a-b b-c a-c`
 */
function generateWorkflow(
  def: string,
  options: Partial<GenerateWorkflowOptions> = {}
) {
  if (!parser) {
    parser = createParser();
  }

  // Calculate the seeded uuid here, so that it's the first value
  let uuid;
  if (options.openfnUuid) {
    uuid = options.uuidSeed ? options.uuidSeed++ : randomUUID();
  }

  const raw = parser.parse(def, options);
  if (!raw.name) {
    raw.name = 'Workflow';
  }

  if (!raw.id) {
    // Workflow ID is required, so make sure it gets set
    // before calling the constructor
    raw.id = 'workflow';
  }
  if (options.uuidMap && raw.id in options.uuidMap) {
    uuid = options.uuidMap[raw.id];
  }

  if (!isNil(uuid) && options.openfnUuid) {
    raw.openfn ??= {};
    raw.openfn.uuid = uuid;
  }

  const wf = new Workflow(raw);
  if (options.history) {
    wf.pushHistory(wf.getVersionHash());
  }
  return wf;
}

function generateProject(
  name: string,
  workflowDefs: string[],
  // The uuid map here must be a sequenced array with a map per workflow
  // (we can't associate id maps by workflow name because we don't know yet)
  options: Partial<GenerateProjectOptions> = {}
) {
  const workflows = workflowDefs.map((w, idx) =>
    generateWorkflow(w, {
      ...options,
      uuidMap: options.uuidMap && options.uuidMap[idx],
    })
  );

  return new Project({
    name,
    workflows,
    openfn: {
      uuid: options.uuid ?? (options.openfnUuid ? randomUUID() : undefined),
    },
  });
}

export default generateWorkflow;

export { generateWorkflow, generateProject };
