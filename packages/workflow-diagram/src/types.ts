import { Edge, Node } from "react-flow-renderer";

type WebhookTrigger = {
  type: "webhook";
};

type FlowTrigger = {
  type: "on_job_failure" | "on_job_success";
  upstreamJob: string;
};

export interface Operation {
  id: string;
  label: string;
  comment?: string;
}

export interface Job {
  id: string;
  name: string;
  adaptor: string;
  trigger: FlowTrigger | WebhookTrigger | CronTrigger;
  operations?: Operation[];
}

export interface FlowJob extends Job {
  trigger: FlowTrigger;
}

export interface ProjectSpace {
  jobs: Job[];
  startingPoint?: { x: number; y: number };
  spacing?: number;
}

export type NodesAndEdges = [nodes: Node[], edges: Edge[]];
