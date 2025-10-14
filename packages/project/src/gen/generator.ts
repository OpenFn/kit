import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { grammar } from 'ohm-js';
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

  // TODO removing on this PR, I swear to god
  openfnUuid: boolean; // TODO probably need to do this by default?
};

type GenerateProjectOptions = GenerateWorkflowOptions & {
  uuidMap: Array<Record<string, string>>;
};

let parser;

const initOperations = (options = {}) => {
  let nodes = {};
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
        name: name,
        id,
        openfn: {
          uuid: uuid(id),
        },
      };
    }
    return nodes[name];
  };

  // These are functions which run on matched parse trees
  const operations = {
    Workflow(attrs, pair) {
      pair.children.forEach((child) => child.buildWorkflow());

      const steps = Object.values(nodes);

      const attributes = attrs.children
        .map((c) => c.buildWorkflow())
        .reduce((obj, next) => {
          const [key, value] = next;
          obj[key] = value;
          return obj;
        }, {});

      return { ...attributes, steps: steps };
    },
    comment(_a, _b) {
      return null;
    },
    attribute(_, name, _space, value) {
      return [name.sourceString, value.sourceString];
    },
    Pair(parent, edge, child) {
      const n1 = parent.buildWorkflow();
      const n2 = child.buildWorkflow();
      const e = edge.buildWorkflow();
      e.openfn.uuid = uuid(`${n1.id}-${n2.id}`);

      n1.next ??= {};

      n1.next[n2.name] = e;

      return [n1, n2];
    },
    // node could just be a node name, or a node with props
    // different results have different requirements
    // Not sure the best way to handle this, but this seems to work
    node(node) {
      if (node._node.ruleName === 'node_name') {
        return buildNode(node.sourceString);
      }
      return node.buildWorkflow();
    },
    nodeWithProps(nameNode, props) {
      const name = nameNode.sourceString;
      const node = buildNode(name);
      props.buildWorkflow().forEach(([key, value]) => {
        nodes[name][key] = value;
      });
      return node;
    },
    node_name(n) {
      return n.sourceString;
    },
    props(_lbr, props, _rbr) {
      return props.asIteration().children.map((c) => c.buildWorkflow());
    },
    prop(key, _op, value) {
      return [key.sourceString, value.buildWorkflow()];
    },
    // Bit flaky - we need this to handle quoted props
    _iter(...items) {
      return items.map((i) => i.buildWorkflow()).join('');
    },
    alnum(a) {
      return a.sourceString;
    },
    quotedProp(_left, value, _right) {
      return value.sourceString;
    },
    edge(_) {
      return {
        openfn: {},
      };
    },
  };

  return operations;
};

export const createParser = () => {
  // Load the grammar
  // TODO: is there any way I can compile/serialize the grammar into JS?
  const grammarPath = path.resolve(import.meta.dirname, 'workflow.ohm');
  const contents = readFileSync(grammarPath, 'utf-8');
  const parser = grammar(contents);

  return {
    parse(str, options) {
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

  const raw = parser.parse(def, options);
  if (!raw.name) {
    raw.name = 'Workflow';
  }
  if (!raw.id) {
    // Workflow ID is required, so make sure it gets set
    // before calling the constructor
    raw.id = 'workflow';
  }

  if (options.openfnUuid) {
    raw.openfn ??= {};
    raw.openfn.uuid = randomUUID();
  }
  const wf = new Workflow(raw);
  return wf;
}

function generateProject(
  name: string,
  workflowDefs: string[],
  // The uuid map here must be a sequenced array with a map per workflow
  // (we can't associate id maps by workflow name because we don't know yet)
  options: Partial<GenerateWorkflowOptions> = {}
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
    openfn: options.openfnUuid && { uuid: randomUUID() },
  });
}

export default generateWorkflow;

export { generateWorkflow, generateProject };
