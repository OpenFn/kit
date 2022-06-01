import { ElkExtendedEdge, ElkNode } from "elkjs";
import { Edge, Node } from "react-flow-renderer";

export interface FlowElkNode extends ElkNode {
  properties?: { label: string; type?: string };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: FlowElkNode[];
}
export type ElkNodeEdges = [FlowElkNode[], ElkExtendedEdge[]];
export type FlowNodeEdges = [Node[], Edge[]];
