import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { grammar } from 'ohm-js';
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
    node(node) {
      const name = node.sourceString;
      if (!nodes[name]) {
        nodes[name] = {
          name,
          openfn: {
            uuid: uuid(),
          },
        };
      }
      return nodes[name];
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
 * The def array contains strings of pairs of nodes
 * eg, ['a-b', 'b-c']
 */
export default function generateWorkflow(
  def: string[],
  options: Partial<GenerateWorkflowOptions> = {}
) {
  if (!parser) {
    parser = createParser();
  }

  return parser.parse(def, options);
}

// /**
//  * Generate a Workflow from a simple text based representation
//  * The def array contains strings of pairs of nodes
//  * eg, ['a-b', 'b-c']
//  */
// export default function generateWorkflow(
//   def: string[],
//   options: Partial<GenerateWorkflowOptions> = {}
// ) {
//   const { name, uuidSeed, openfnUuid } = options;

//   const wf = gen(def, name, uuidSeed, openfnUuid);
//   return new Workflow(wf);
// }

// function gen(
//   def: string[],
//   name: string = 'workflow',
//   uuidSeed?: number,
//   openfnUuid?: boolean
// ) {
//   const ids = new Map<string, string>();
//   const nodes: Record<string, any> = {};

//   for (const conn of def) {
//     const [from, to] = conn.split('-');
//     // create node for from and to
//     if (nodes[from]) {
//       if (to) {
//         if (!nodes[from].next?.[to]) {
//           nodes[from].next ??= {};
//           nodes[from].next[to] = edge(`${from}-${to}`);
//         }
//       }
//     } else {
//       let props;
//       if (to) {
//         props = { next: { [to]: edge(`${from}-${to}`) } };
//       }
//       nodes[from] = node(from, props);
//     }
//     if (to && !nodes[to]) {
//       nodes[to] = node(to);
//     }
//   }

//   return {
//     name: name,
//     id: slugify(name),
//     steps: Object.values(nodes),
//     ...(openfnUuid ? { openfn: { uuid: randomUUID() } } : {}),
//   };

//   // Generate a node with an openfn.uuid property
//   function node(id, props = {}) {
//     return {
//       id,
//       ...props,
//       openfn: { uuid: uuid(id) },
//     };
//   }

//   function edge(id, props = {}) {
//     return {
//       ...props,
//       openfn: { uuid: uuid(id) },
//     };
//   }

//   function uuid(id: string) {
//     const muuid = !isNaN(uuidSeed) ? ++uuidSeed : randomUUID();
//     ids.set(id, muuid);
//     return muuid;
//   }
// }
