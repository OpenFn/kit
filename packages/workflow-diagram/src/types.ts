import { Edge, Node } from "react-flow-renderer";

export type CronTrigger = {
  type: "cron";
};

export type WebhookTrigger = {
  type: "webhook";
};

export type FlowTrigger = {
  type: "on_job_failure" | "on_job_success";
  upstreamJob: string;
};

export type Trigger = CronTrigger | WebhookTrigger | FlowTrigger;

export interface Operation {
  id: string;
  label: string;
  comment?: string;
}

export interface Job {
  id: string;
  workflowId: string;
  name: string;
  enabled: boolean;
  adaptor: string;
  trigger: Trigger;
  operations?: Operation[];
  hasDescendents?: boolean;
}

export interface FlowJob extends Job {
  trigger: FlowTrigger;
}

export interface Workflow {
  id: string;
  name: string | null;
}

export interface ProjectSpace {
  jobs: Job[];
  workflows: Workflow[];
  startingPoint?: { x: number; y: number };
  spacing?: number;
}

export type NodesAndEdges = [nodes: Node[], edges: Edge[]];
