import React, { useEffect } from "react";
import AddNode from "./nodes/AddNode";
import JobNode from "./nodes/JobNode";
import OperationNode from "./nodes/OperationNode";
import TriggerNode from "./nodes/TriggerNode";
import type { ProjectSpace } from "./types";

import ReactFlow from "react-flow-renderer";
import "./main.css";
import { useStore } from "./store";

const nodeTypes = {
  job: JobNode,
  add: AddNode,
  operation: OperationNode,
  trigger: TriggerNode,
};

const WorkflowDiagram: React.FC<{
  projectSpace: ProjectSpace;
  onNodeClick?: (event: React.MouseEvent, {}) => void;
  onPaneClick?: (event: React.MouseEvent) => void;
}> = ({ projectSpace, onNodeClick, onPaneClick }) => {
  const { nodes, edges, onNodesChange, onEdgesChange, setProjectSpace } =
    useStore();

  useEffect(() => {
    setProjectSpace(projectSpace);
  }, [projectSpace]);

  return (
    <ReactFlow
      // Thank you, Christopher Möller, for explaining that we can use this...
      proOptions={{ account: "paid-pro", hideAttribution: true }}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      // onConnect={onConnect}
      // If we let folks drag, we have to save new visual configuration...
      nodesDraggable={false}
      // No interaction for this yet...
      nodesConnectable={false}
      nodeTypes={nodeTypes}
      snapToGrid={true}
      snapGrid={[10, 10]}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
    />
  );
};

export default WorkflowDiagram;
