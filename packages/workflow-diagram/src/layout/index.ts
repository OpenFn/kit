/**
 * Layout algorithm code for automatically providing dimensions and positions
 * for Jobs, Triggers and Operations.
 *
 * It works by first converting a `ProjectSpace` into a nested `ElkNode`-like
 * object (with `properties` added for later).
 * Then the resulting object is passed to ELKs layout function, which adds
 * coordinates to all the nodes.
 * And finally with `flattenElk` we both flatten and convert the ELK object
 * to one compatible with React Flow.
 */

import ELK from "elkjs/lib/elk.bundled";
import type { LayoutOptions } from "elkjs";

import { Edge, Node } from "react-flow-renderer";
import { FlowJob, Job, ProjectSpace } from "types";
import { Rect, ChildRect } from "./flow-nodes";
import { FlowElkNode, FlowNodeEdges, ElkNodeEdges } from "./types";
import { NONAME } from "dns";

/**
 * Flattens an ELK node into a tuple of Nodes and Edges that are
 * compatible with React Flow.
 */
export function flattenElk(node: FlowElkNode): FlowNodeEdges {
  return (node.children || []).reduce<FlowNodeEdges>(
    ([nodes, edges], c) => {
      const [childNodes, childEdges] = flattenElk(c);

      // TODO: @Amber, add plus button...
      console.log(
        "@Amber, I've managed to calculate whether a node has any descendants",
        'and it shows up here as "type" ... if node.type == output, then we',
        "should add another node which is child to IT with a custom shape",
        nodes
      );

      return [
        [
          ...nodes.map((n) => {
            console.log(n);
            return n;
          }),
          Rect(c),
          ...childNodes.map((n) => ChildRect(c, n)),
        ],
        [...edges, ...childEdges],
      ] as FlowNodeEdges;
    },
    [
      [],
      (node.edges || []).map((e) => {
        return {
          ...e,
          source: e.sources[0],
          target: e.targets[0],
          animated: true,
          labelBgStyle: { fill: "#f3f4f6" },
        } as Edge;
      }),
    ]
  );
}

/**
 * Get the correct node type given whether the current Node has either an
 * ancestor and/or a descendent.
 *
 * In the case of React Flow, this will result in a Node having either an
 * input and/or output handles.
 */
function getNodeType(hasAncestor: boolean, hasDescendent: boolean) {
  if (hasAncestor && hasDescendent) {
    return "default";
  }

  if (hasAncestor) {
    return "output";
  }

  if (hasDescendent) {
    return "input";
  }
}

function deriveOperations(job: Job): ElkNodeEdges {
  if (job.operations) {
    return job.operations.reduce<ElkNodeEdges>(
      ([nodes, edges], op, i, arr) => {
        const hasAncestor = i > 0;
        const hasDescendent = i < arr.length - 1;

        const prevOperation = nodes[nodes.length - 1];

        const edge = prevOperation
          ? [
              {
                id: `${prevOperation.id}->${op.id}`,
                sources: [prevOperation.id],
                targets: [op.id],
                animated: true,
              },
            ]
          : [];

        const operation = [
          {
            id: op.id,
            properties: {
              label: op.label,
              type: getNodeType(hasAncestor, hasDescendent),
            },
            layoutOptions: {
              "elk.direction": "DOWN",
              "elk.padding": "[top=0,left=10.0,bottom=10.0,right=10.0]",
            },
            children: [],
            edges: [],
            width: 130,
            height: 40,
          },
        ];

        return mergeTuples([nodes, edges], [operation, edge]);
      },
      [[], []]
    );
  }

  return [[], []];
}

function deriveCron(job: Job): ElkNodeEdges {
  const [operationNodes, operationEdges] = deriveOperations(job);

  const triggerNode = {
    id: `${job.id}-cron`,
    properties: { label: "Cron", type: "trigger" },
    children: [],
    edges: [],
    width: 100,
    height: 40,
  };

  const jobNode = {
    id: job.id,
    properties: { label: job.name, type: getNodeType(true, job.hasDescendent) },
    children: operationNodes,
    edges: operationEdges,
    layoutOptions: {
      "elk.direction": "DOWN",
      "elk.padding": "[top=35,left=10.0,bottom=10.0,right=10.0]",
    },
    width: 150,
    height: 40,
  };

  return [
    [triggerNode, jobNode],
    [
      {
        id: `${triggerNode.id}->${job.id}`,
        sources: [triggerNode.id],
        targets: [jobNode.id],
        label: "on match",
        sections: [],
      },
    ],
  ];
}

function deriveWebhook(job: Job): ElkNodeEdges {
  const [operationNodes, operationEdges] = deriveOperations(job);

  const triggerNode = {
    id: `${job.id}-webhook`,
    properties: { label: "Webhook", type: "trigger" },
    children: [],
    edges: [],
    width: 150,
    height: 40,
  };

  const jobNode = {
    id: job.id,
    properties: {
      label: job.name,
      type: getNodeType(true, job.hasDescendent),
      id: job.id,
    },
    children: operationNodes,
    edges: operationEdges,
    layoutOptions: {
      "elk.direction": "DOWN",
      "elk.padding": "[top=35,left=10.0,bottom=10.0,right=10.0]",
    },
    width: 150,
    height: 40,
  };

  return [
    [triggerNode, jobNode],
    [
      {
        id: `${triggerNode.id}->${job.id}`,
        sources: [triggerNode.id],
        targets: [jobNode.id],
        label: "on receipt",
        sections: [],
      },
    ],
  ];
}

function deriveFlow(job: FlowJob): ElkNodeEdges {
  const [operationNodes, operationEdges] = deriveOperations(job);

  const jobNode = {
    id: job.id,
    properties: {
      label: job.name,
      type: getNodeType(true, job.hasDescendent),
      id: job.id,
    },
    children: operationNodes,
    edges: operationEdges,
    layoutOptions: {
      "elk.direction": "DOWN",
      "elk.padding": "[top=35,left=10.0,bottom=10.0,right=10.0]",
    },
    width: 150,
    height: 40,
  };

  const label =
    job.trigger.type == "on_job_failure" ? "on failure" : "on success";
  const className =
    job.trigger.type == "on_job_failure" ? "fail-stroke" : "success-stroke";

  const edge = {
    id: `${job.trigger.upstreamJob}->${job.id}`,
    sources: [job.trigger.upstreamJob],
    targets: [jobNode.id],
    label,
  };

  return [[jobNode], [edge]];
}

export function deriveNodesWithEdges(job: Job): ElkNodeEdges {
  switch (job.trigger.type) {
    case "cron":
      return deriveCron(job);

    case "webhook":
      return deriveWebhook(job);

    case "on_job_failure":
    case "on_job_success":
      return deriveFlow(job as FlowJob);
    default:
      throw new Error(`Got unrecognised job: ${JSON.stringify(job)}`);
  }
}

function mergeTuples(
  [a, c]: [any[], any[]],
  [b, d]: [any[], any[]]
): [any[], any[]] {
  return [
    [...a, ...b],
    [...c, ...d],
  ];
}

const defaultLayoutOptions: LayoutOptions = {
  "elk.algorithm": "elk.mrtree",
  "elk.direction": "DOWN",
  // "elk.separateConnectedComponents": true,
  // "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.alignment": "RIGHT",
  "spacing.nodeNode": "70",
  "spacing.nodeNodeBetweenLayers": "45",
  "spacing.edgeNode": "25",
  "spacing.edgeNodeBetweenLayers": "20",
  "spacing.edgeEdge": "20",
  "spacing.edgeEdgeBetweenLayers": "15",
};

export function toElkNode(projectSpace: ProjectSpace) {
  const [children, edges] = projectSpace.jobs
    .map((x) => {
      // TODO: @Amber, refactor this maybe? feels heavy but I'm not sure there's
      // another way.
      const hasDescendent = !!projectSpace.jobs.find(
        (j) => j?.trigger?.upstreamJob == x.id
      );

      return { ...x, hasDescendent };
    })
    .reduce<ElkNodeEdges>(
      (nodesAndEdges, job) => {
        return mergeTuples(nodesAndEdges, deriveNodesWithEdges(job));
      },
      [[], []]
    );
  return {
    id: "root",
    layoutOptions: defaultLayoutOptions,
    children,
    edges,
  };
}

export async function toFlow(node: FlowElkNode): Promise<{
  nodes: Node<any>[];
  edges: Edge<any>[];
}> {
  const elk = new ELK();

  const elkResults = (await elk.layout(node)) as FlowElkNode;

  const [nodes, edges] = flattenElk(elkResults);

  return { nodes, edges };
}
