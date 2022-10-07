import { Job, Operation, TriggerType, Workflow } from "types";
import { FlowElkNode, ElkNodeEdges, EdgeFlowProps, FlowElkEdge } from "./types";

const defaultLayoutOptions = {
  "elk.direction": "DOWN",
  "elk.padding": "[top=35,left=10.0,bottom=10.0,right=10.0]",
};

function edgeFlowProps(attrs: Partial<EdgeFlowProps>): EdgeFlowProps {
  return {
    animated: false,
    ...attrs,
  };
}

/**
 * Builds a pair of Node/Edges with the `add` type assigned.
 *
 * @param node The Node that will be the parent to this add button
 */
export function addNodeFactory(node: FlowElkNode): ElkNodeEdges {
  const addNode = {
    id: `${node.id}-add`,
    __flowProps__: {
      data: {
        parentId: node.id,
        label: "Add",
      },
      type: "add",
    },
    layoutOptions: defaultLayoutOptions,
    width: 24,
    height: 24,
  };

  const addEdge = {
    id: `${node.id}->${node.id}-add`,
    sources: [node.id],
    targets: [addNode.id],
    __flowProps__: edgeFlowProps({ dashed: false }),
  };

  return [[addNode], [addEdge]];
}

const TriggerLabels: { [key in TriggerType]: string } = {
  cron: "Cron",
  webhook: "Webhook",
  on_job_failure: "on failure",
  on_job_success: "on success",
};

export function triggerNodeFactory(job: Job, workflow: Workflow): FlowElkNode {
  return {
    id: `${job.id}-trigger`,
    __flowProps__: {
      data: { label: TriggerLabels[job.trigger.type], workflow },
      type: "trigger",
    },
    width: 150,
    height: 50,
  };
}

/**
 * Builds an ELK node based off a Job, and assigns extra information
 * for use in ReactFlow in the `__flowProps__` key.
 */
export function jobNodeFactory(job: Job): FlowElkNode {
  return {
    id: job.id,
    __flowProps__: {
      data: {
        label: job.name,
        id: job.id,
        workflowId: job.workflowId,
      },
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
    __flowProps__: {
      data: {
        label: workflow.name,
        id: workflow.id,
      },
      type: "workflow",
    },
    children: [],
    edges: [],
    layoutOptions: {
      "elk.separateConnectedComponents": "true",
      "elk.algorithm": "elk.mrtree",
      "elk.direction": "DOWN",
      "elk.padding": "[top=40,left=20.0,bottom=20.0,right=20.0]",
      "elk.alignment": "RIGHT",
      "spacing.nodeNode": "70",
      "spacing.nodeNodeBetweenLayers": "45",
      "spacing.edgeNode": "25",
      "spacing.edgeNodeBetweenLayers": "20",
      "spacing.edgeEdge": "20",
      "spacing.edgeEdgeBetweenLayers": "15",
    },
    width: 150,
    height: 100,
  };
}

export function operationNodeFactory(operation: Operation): FlowElkNode {
  return {
    id: operation.id,
    __flowProps__: {
      data: { label: operation.label },
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
  };
}

export function operationEdgeFactory(
  operation: Operation,
  prevOperation: FlowElkNode
): FlowElkEdge {
  return {
    id: `${prevOperation.id}->${operation.id}`,
    sources: [prevOperation.id],
    targets: [operation.id],
    __flowProps__: {
      animated: false,
      dashed: false,
      // markerEnd: { type: "arrowclosed" },
    },
  };
}
