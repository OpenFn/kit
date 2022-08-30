/**
 * A collection of functions used to convert ELK Node objects into
 * React Flow Nodes.
 */
import { Edge, Node } from "react-flow-renderer";
import { FlowElkEdge, FlowElkNode } from "./types";
import cc from "classcat";

/**
 * Builds a Node object ready to be given to React Flow.
 * @param node a node that has been passed through Elk with it's layout
 * calculations applied
 */
export function toFlowNode(node: FlowElkNode): Node {
  const isContainer = hasChildren(node);

  return {
    id: node.id,
    style: {
      height: node.height,
      width: node.width,
      zIndex: isContainer ? -1 : 1,
    },
    position: { x: node.x || 0, y: node.y || 0 },
    ...nodeData(node),
    ...nodeType(node),
  };
}

export function toChildFlowNode(parent: FlowElkNode, node: Node): Node {
  return {
    ...node,
    parentNode: parent.id,
    extent: "parent",
  };
}

/**
 * Builds an Edge object ready to be given to React Flow.
 * @param edge an edge that has been passed through Elk with it's layout
 * calculations applied
 */
export function toFlowEdge(edge: FlowElkEdge): Edge {
  const className = cc({
    "dashed-edge": edge.properties.dashed,
    "dotted-edge": edge.properties.dotted,
  });

  return {
    ...edge,
    source: edge.sources[0],
    target: edge.targets[0],
    animated: edge.properties.animated,
    labelBgStyle: { fill: "#f3f4f6" },
    className,
  };
}

function nodeData(node: FlowElkNode) {
  const hasChildren = (node.children || []).length > 0;

  if (node.properties) {
    return {
      data: {
        id: node.id,
        hasChildren,
        ...node.properties,
      },
    };
  }

  return { data: {} };
}

function nodeType(node: FlowElkNode) {
  if (node.properties && node.properties.type) {
    {
      return { type: node.properties.type };
    }
  }

  return {};
}

function hasChildren(node: FlowElkNode): Boolean {
  if (node.children && node.children.length > 0) {
    return true;
  }

  return false;
}
