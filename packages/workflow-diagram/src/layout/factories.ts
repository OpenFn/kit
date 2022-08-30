import { Job, Workflow } from "types";
import { FlowElkNode, ElkNodeEdges } from "./types";

const defaultLayoutOptions = {
  "elk.direction": "DOWN",
  "elk.padding": "[top=35,left=10.0,bottom=10.0,right=10.0]",
};

/**
 * Builds a pair of Node/Edges with the `add` type assigned.
 *
 * @param node The Node that will be the parent to this add button
 */
export function addNodeFactory(node: FlowElkNode): ElkNodeEdges {
  const addNode = {
    id: `${node.id}-add`,
    properties: {
      type: "add",
      label: "Add",
      parentId: node.id,
    },
    layoutOptions: defaultLayoutOptions,
    width: 24,
    height: 24,
  };

  const addEdge = {
    id: `${node.id}->${node.id}-add`,
    sources: [node.id],
    targets: [addNode.id],
    properties: { animated: false, dashed: true },
  };

  return [[addNode], [addEdge]];
}

/**
 * Builds an ELK node based off a Job, and assigns extra information
 * for use in ReactFlow in the `properties` key.
 */
export function jobNodeFactory(job: Job): FlowElkNode {
  return {
    id: job.id,
    properties: {
      label: job.name,
      type: "job",
    },
    children: [],
    edges: [],
    layoutOptions: defaultLayoutOptions,
    width: 150,
    height: 40,
  };
}

export function workflowNodeFactory(workflow: Workflow): FlowElkNode {
  return {
    id: workflow.id,
    properties: {
      label: workflow.name || "null",
      type: "workflow",
    },
    children: [],
    edges: [],
    layoutOptions: defaultLayoutOptions,
    width: 150,
    height: 40,
  };
}

