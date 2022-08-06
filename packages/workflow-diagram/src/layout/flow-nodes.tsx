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
  const isContainer = node.children.length > 0;

  return {
    id: node.id,
    style: {
      height: node.height,
      width: node.width,
      zIndex: isContainer ? -1 : 1,
      // todo: clean up colors and borders
      borderColor: "#d3d3d3",
      // backgroundColor: isContainer
      //   ? "rgba(255,255,255,0.5)"
      //   : "rgba(255,255,255,0.85)",
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
