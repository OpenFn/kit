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
  openfnUuid: boolean;
  printErrors: boolean; // true by default
};

let parser;

const initOperations = (options = {}) => {
  let nodes = {};

  // Sets values available to this inside semantic actions
  const uuid = () => {
    return options.uuidSeed ? options.uuidSeed++ : randomUUID();
  };

  const buildNode = (name: string) => {
    if (!nodes[name]) {
      nodes[name] = {
        name,
        openfn: {
          uuid: uuid(),
        },
      };
    }
    return nodes[name];
  };

  // These are functions which run on matched parse trees
  const operations = {
    Workflow(pair) {
      pair.children.forEach((child) => child.buildWorkflow());

      const steps = Object.values(nodes);

      return { steps: steps };
    },
    Pair(parent, edge, child) {
      const n1 = parent.buildWorkflow();
      const n2 = child.buildWorkflow();
      const e = edge.buildWorkflow();

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
      return [key.sourceString, value.sourceString];
    },
    Edge(_) {
      return {
        openfn: {
          uuid: uuid(),
        },
      };
    },
  };

  return operations;
};

export const createParser = () => {
  // Load the grammar
  // TODO: is there any way I can compile/serialize the grammar into JS?
  const contents = readFileSync(path.resolve('src/gen/workflow.ohm'), 'utf-8');
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

  return parser.parse(def, options);
}

function generateProject(
  name: string,
  workflowDefs: string[],
  options: Partial<GenerateWorkflowOptions>
) {
  const workflows = workflowDefs.map((w) => generateWorkflow(w, options));

  return new Project({
    name,
    workflows,
  });
}

export default generateWorkflow;

export { generateWorkflow, generateProject };
