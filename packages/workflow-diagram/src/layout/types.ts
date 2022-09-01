import { ElkExtendedEdge, ElkNode } from "elkjs";
import { Edge, EdgeMarker, Node } from "react-flow-renderer";

export interface EdgeFlowProps {
  animated: boolean;
  dashed?: boolean;
  dotted?: boolean;
  markerEnd?: EdgeMarker;
}

export interface FlowElkEdge extends ElkExtendedEdge {
  __flowProps__: EdgeFlowProps;
}

export interface NodeFlowProps {
  data: {
    label: string;
    workflowId?: string;
    parentId?: string;
    [key: string]: any;
  };
  type: string;
}

export interface FlowElkNode extends ElkNode {
  __flowProps__: NodeFlowProps;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: FlowElkNode[];
  edges?: FlowElkEdge[];
}

export type ElkNodeEdges = [FlowElkNode[], FlowElkEdge[]];
export type FlowNodeEdges = [Node[], Edge[]];
