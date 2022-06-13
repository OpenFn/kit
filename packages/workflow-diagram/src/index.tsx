import { toElkNode, toFlow } from "layout";
import React, { useEffect, useCallback } from "react";
import ReactFlow, { useNodesState, useEdgesState } from "react-flow-renderer";
// import "./main.css";
// import TriggerNode from "./TriggerNode";
import { ProjectSpace } from "./types";
import JobNode from "./nodes/JobNode";

import "./main.css";

const nodeTypes = {
  job: JobNode,
};

const WorkflowDiagram: React.FC<{
  projectSpace: ProjectSpace;
  onNodeClick?: ({}) => void;
}> = ({ projectSpace, onNodeClick }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const elkNodes = toElkNode(projectSpace);

    toFlow(elkNodes).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
    });
  }, []);

  const outerRef = useCallback((node: Element) => {
    if (onNodeClick) {
      node.addEventListener("node-clicked", (e: CustomEventInit<any>) => {
        onNodeClick(e.detail);
      });
    }
  }, []);

  return (
    <ReactFlow
      ref={outerRef}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      // onConnect={onConnect}
      nodeTypes={nodeTypes}
      snapToGrid={true}
      snapGrid={[10, 10]}
      fitView
    />
  );
};

export default WorkflowDiagram;
