import React from "react";
import ReactFlow, {
  useNodesState,
  useEdgesState,
} from "react-flow-renderer";
import "./main.css";
import TriggerNode from "./TriggerNode";
import { toFlow } from "./project-space";
import { ProjectSpace } from "./types";

const nodeTypes = {
  trigger: TriggerNode
};

const App: React.FC<{ projectSpace: ProjectSpace }> = ({ projectSpace }) => {
  const [n, e] = toFlow(projectSpace);

  const [nodes, setNodes, onNodesChange] = useNodesState(n);
  const [edges, setEdges, onEdgesChange] = useEdgesState(e);

  return (
    <div className="h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        snapToGrid={true}
        snapGrid={[10, 10]}
        fitView
      />
    </div>
  );
};

export default App;
