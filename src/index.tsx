import React from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
} from "react-flow-renderer";
import "./main.css";
import TriggerNode from "./TriggerNode";
import { MarkerType } from "react-flow-renderer";
import { ProjectSpace, toFlow } from "./ProjectSpace";
interface Props {
  foo: string;
}

const nodeTypes = {
  trigger: TriggerNode,
};

const initialNodes = [
  {
    id: "1",
    type: "trigger",
    data: { label: "Inbound Webhook" },
    position: { x: 100, y: 0 },
  },

  {
    id: "2",
    // you can also pass a React component as a label
    data: {
      label: (
        <div>
          <p className="font-bold">Salesforce</p>Job Name
        </div>
      ),
    },
    position: { x: 100, y: 125 },
  },
  {
    id: "3",
    type: "output",
    data: {
      label: (
        <div>
          <p className="font-bold">DHIS2</p>Job Name
        </div>
      ),
    },
    position: { x: 250, y: 250 },
  },
  {
    id: "4",
    data: {
      label: (
        <div>
          <p className="font-bold">MailGun</p>Job Name
        </div>
      ),
    },
    position: { x: 75, y: 250 },
    className: "!bg-rose-500",
  },
];

const initialEdges = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    label: "initial trigger",
    labelBgStyle: { fillOpacity: 0.0 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  },
  {
    id: "e2-4",
    source: "2",
    target: "4",
    animated: false,
    label: "fail",
    labelBgStyle: { fillOpacity: 0.0 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    animated: true,
    label: "success",
    labelBgStyle: { fillOpacity: 0.0 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  },
];

const snapGrid = [10, 10];



const App: React.FC<{ projectSpace: ProjectSpace }> = ({ projectSpace }) => {
  const [n,e] = toFlow(projectSpace)
  
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
        snapGrid={snapGrid}
        fitView
      />
    </div>
  );
};

export default App;
