import { toElkNode, toFlow } from "layout";
import React, { useEffect } from "react";
import ReactFlow, { useNodesState, useEdgesState } from "react-flow-renderer";
// import "./main.css";
// import TriggerNode from "./TriggerNode";
import { ProjectSpace } from "./types";

// const nodeTypes = {
//   trigger: TriggerNode
// };

const WorkflowDiagram: React.FC<{ projectSpace: ProjectSpace }> = ({ projectSpace }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const elkNodes = toElkNode(projectSpace);

    toFlow(elkNodes).then(({ nodes, edges }) => {
      setNodes(nodes);
      setEdges(edges);
    });
  }, []);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      // onConnect={onConnect}
      // nodeTypes={nodeTypes}
      snapToGrid={true}
      snapGrid={[10, 10]}
      fitView
    />
  );
};

export default WorkflowDiagram;
