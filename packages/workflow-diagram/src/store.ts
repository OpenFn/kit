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

export const useStore = create<RFState>((set, get) => ({
  projectSpace: null,
  nodes: [],
  edges: [],
  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
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
