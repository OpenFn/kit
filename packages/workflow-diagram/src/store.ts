import {
  applyEdgeChanges,
  applyNodeChanges,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnEdgesChange,
  OnNodesChange,
} from "react-flow-renderer";
import { ProjectSpace } from "./types";
import create from "zustand";
import { toElkNode, toFlow } from "./layout";

type RFState = {
  nodes: Node[];
  edges: Edge[];
  projectSpace: ProjectSpace | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setProjectSpace: (projectSpace: ProjectSpace) => Promise<void>;
};

// this is our useStore hook that we can use in our components to get parts of the store and call actions
export const useStore = create<RFState>((set, get) => ({
  projectSpace: null,
  nodes: [],
  edges: [],
  onNodesChange: (changes: NodeChange[]) => {
    console.log({ onNodesChange: changes });

    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    console.log({ onEdgesChange: changes });
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  async setProjectSpace(projectSpace: ProjectSpace) {
    const elkNodes = toElkNode(projectSpace);

    const [nodes, edges] = await toFlow(elkNodes);
    set({ nodes, edges, projectSpace });
  },
}));
