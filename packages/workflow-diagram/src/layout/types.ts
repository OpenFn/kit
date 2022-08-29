import { ElkExtendedEdge, ElkNode } from "elkjs";
import { Edge, Node } from "react-flow-renderer";

export interface FlowElkEdge extends ElkExtendedEdge {
  properties: { animated: boolean, dashed?: boolean, dotted?: boolean };
}

export interface FlowElkNode extends ElkNode {
  properties?: { label: string; type?: string };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: FlowElkNode[];
  edges?: FlowElkEdge[];
}

export type ElkNodeEdges = [FlowElkNode[], FlowElkEdge[]];
export type FlowNodeEdges = [Node[], Edge[]];
