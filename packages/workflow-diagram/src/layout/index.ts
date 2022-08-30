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

import type { LayoutOptions } from "elkjs";
import ELK from "elkjs/lib/elk.bundled";

import { FlowJob, FlowTrigger, Job, ProjectSpace, Workflow } from "types";
import { addNodeFactory, jobNodeFactory, workflowNodeFactory } from "./factories";
import { toChildFlowNode, toFlowEdge, toFlowNode } from "./flow-nodes";
import { ElkNodeEdges, FlowElkNode, FlowNodeEdges } from "./types";

/**
 * Flattens an ELK node into a tuple of Nodes and Edges that are
 * compatible with React Flow.
 */
export function flattenElk(node: FlowElkNode): FlowNodeEdges {
  return (node.children || []).reduce<FlowNodeEdges>(
    (acc: FlowNodeEdges, node) => {
      const [childNodes, childEdges] = flattenElk(node);

      return mergeTuples(acc, [
        [
          toFlowNode(node),
          ...childNodes.map((childNode) => toChildFlowNode(node, childNode)),
        ],
        childEdges,
      ]);
    },
    [[], (node.edges || []).map(toFlowEdge)] as FlowNodeEdges
  );
}

function deriveOperations(job: Job): ElkNodeEdges {
  if (job.operations) {
    return job.operations.reduce<ElkNodeEdges>(
      ([nodes, edges], op) => {
        const prevOperation = nodes[nodes.length - 1];

        const edge = prevOperation
          ? [
              {
                id: `${prevOperation.id}->${op.id}`,
                sources: [prevOperation.id],
                targets: [op.id],
                properties: { animated: false, dashed: true },
                markerEnd: { type: "arrowclosed" },
              },
            ]
          : [];

        const operation = [
          {
            id: op.id,
            properties: {
              label: op.label,
              type: "operation",
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

  const triggerNode: FlowElkNode = {
    id: `${job.id}-cron`,
    properties: { label: "Cron", type: "trigger" },
    width: 100,
    height: 40,
  };

  const jobNode = {
    ...jobNodeFactory(job),
    children: operationNodes,
    edges: operationEdges,
  };

  return mergeTuples(
    [
      [triggerNode, jobNode],
      [
        {
          id: `${triggerNode.id}->${job.id}`,
          sources: [triggerNode.id],
          targets: [jobNode.id],
          label: "on match",
          properties: { animated: true },
        },
      ],
    ],
    addNodeFactory(jobNode)
  );
}

function deriveWebhook(job: Job): ElkNodeEdges {
  const [operationNodes, operationEdges] = deriveOperations(job);

  const triggerNode = {
    id: `${job.id}-webhook`,
    properties: { label: "Webhook", type: "trigger" },
    width: 100,
    height: 40,
  };

  const jobNode = {
    ...jobNodeFactory(job),
    children: operationNodes,
    edges: operationEdges,
  };

  return mergeTuples(
    [
      [triggerNode, jobNode],
      [
        {
          id: `${triggerNode.id}->${job.id}`,
          sources: [triggerNode.id],
          targets: [jobNode.id],
          label: "on receipt",
          properties: { animated: true },
        },
      ],
    ],
    addNodeFactory(jobNode)
  );
}

function deriveFlow(job: FlowJob): ElkNodeEdges {
  const [operationNodes, operationEdges] = deriveOperations(job);

  const jobNode = {
    ...jobNodeFactory(job),
    children: operationNodes,
    edges: operationEdges,
  };

  const label =
    job.trigger.type == "on_job_failure" ? "on failure" : "on success";

  const edge = {
    id: `${job.trigger.upstreamJob}->${job.id}`,
    sources: [job.trigger.upstreamJob],
    targets: [jobNode.id],
    properties: { animated: true },
    label,
  };

  return mergeTuples([[jobNode], [edge]], addNodeFactory(jobNode));
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

function hasDescendent(projectSpace: ProjectSpace, job: Job): boolean {
  return Boolean(
    projectSpace.jobs.find((j) => {
      if (j.trigger.type in ["on_job_failure", "on_job_success"]) {
        return (j.trigger as FlowTrigger).upstreamJob == job.id;
      }
    })
  );
}

/**
 * Turns a ProjectSpace object into a FlowElkNode, this can be handled to ELK
 * for layout calculation.
 *
 * The extended interface (`FlowElkNode`) has extra properties on it in order
 * to preserve specific information for React Flow.
 *
 * @param projectSpace
 */
export function toElkNode(projectSpace: ProjectSpace): FlowElkNode {
  console.log(groupByWorkflow(projectSpace));

  let nodeEdges: ElkNodeEdges = [[], []];

  for (const [workflow, jobs] of groupByWorkflow(projectSpace)) {

    let [jobNodes, jobEdges] = jobs.reduce<ElkNodeEdges>(
      (nodesAndEdges, job) => {
        return mergeTuples(
          nodesAndEdges,
          deriveNodesWithEdges({
            ...job,
            hasDescendents: hasDescendent(projectSpace, job),
          })
        );
      },
      [[], []]
    );

    nodeEdges = mergeTuples(nodeEdges, [[{...workflowNodeFactory(workflow), children: jobNodes, edges: jobEdges}], []]);
  }

  const [children, edges] = nodeEdges;
  return {
    id: "root",
    layoutOptions: defaultLayoutOptions,
    children,
    edges,
  };
}

function groupByWorkflow(projectSpace: ProjectSpace): Map<Workflow, Job[]> {
  return new Map(
    projectSpace.workflows.map((workflow) => [
      workflow,
      projectSpace.jobs.filter(({ workflowId }) => workflowId == workflow.id),
    ])
  );
}

export async function toFlow(node: FlowElkNode): Promise<FlowNodeEdges> {
  const elk = new ELK();

  const elkResults = (await elk.layout(node)) as FlowElkNode;

  return flattenElk(elkResults);
}
