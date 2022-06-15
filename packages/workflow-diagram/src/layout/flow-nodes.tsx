/**
 * A collection of functions used to convert ELK Node objects into
 * React Flow Nodes.
 */
import { Node } from "react-flow-renderer";
import { FlowElkNode } from "./types";

function nodeData(node: FlowElkNode) {
  const hasChildren = (node.children || []).length > 0;

  if (node.properties) {
    return {
      data: {
        label: node.properties.label,
        id: node.id,
        type: node.properties.type,
        hasChildren,
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

export function Rect(node: FlowElkNode): Node {
  return {
    id: node.id,
    style: {
      height: node.height,
      width: node.width,
      backgroundColor: "rgba(240,240,240,0)",
    },
    position: { x: node.x || 0, y: node.y || 0 },

    ...nodeData(node),
    ...nodeType(node),
  };
}
export function ChildRect(parent: FlowElkNode, node: Node): Node {
  return {
    ...node,
    parentNode: parent.id,
    extent: "parent",
  };
}
