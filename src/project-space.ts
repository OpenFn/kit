import { digl } from "@crinkles/digl";
import { Edge, Node } from "react-flow-renderer";

type WebhookTrigger = {
  type: "webhook";
};

type FlowTrigger = {
  type: "on_job_failure" | "on_job_success";
  upstreamJob: string;
};

export interface Job {
  id: string;
  name: string;
  adaptor: string;
  trigger: FlowTrigger | WebhookTrigger;
}

export interface FlowJob extends Job {
  trigger: FlowTrigger;
}

export interface ProjectSpace {
  jobs: Job[];
  startingPoint?: { x: number; y: number };
  spacing?: number;
}

export function createPositionFactory(
  nodes: { id: string }[],
  edges: { id: string; source: string; target: string }[],
  options: {
    width?: number;
    height?: number;
    orientation?: "horizontal" | "vertical";
  } = {}
): (nodeId: string) => { x: number; y: number } {
  const machine = digl({
    width: 150,
    height: 100,
    orientation: "vertical",
    shortestPath: false,
    addEmptySpots: false,
    ...options,
  });

  const positions = machine.positions(nodes[0].id, nodes, edges);

  return (nodeId: string) => {
    const position = positions.find(({ id }) => id == nodeId);

    if (position) {
      return { x: position.x, y: position.y };
    } else {
      return { x: -1, y: -1 };
    }
  };
}

function deriveWebhook(job: Job): NodesAndEdges {
  const triggerNode = {
    id: `${job.id}-webhook`,
    data: { label: "Webhook" },
    type: "input",
    position: { x: 0, y: 0 },
  };
  const jobNode = {
    id: job.id,
    data: { label: job.name },
    position: { x: 0, y: 0 },
  };
  return [
    [triggerNode, jobNode],
    [
      {
        id: `${triggerNode.id}->${job.id}`,
        source: triggerNode.id,
        target: jobNode.id,
      },
    ],
  ];
}

function deriveFlow(job: FlowJob): NodesAndEdges {
  const jobNode = {
    id: job.id,
    data: { label: job.name },
    position: { x: 0, y: 0 },
  };
  const edge = {
    id: `${job.trigger.upstreamJob}->${job.id}`,
    source: job.trigger.upstreamJob,
    target: jobNode.id,
  };

  return [[jobNode], [edge]];
}

type NodesAndEdges = [nodes: Node[], edges: Edge[]];

export function deriveNodesWithEdges(job: Job): NodesAndEdges {
  switch (job.trigger.type) {
    case "webhook":
      return deriveWebhook(job);

    case "on_job_failure":
    case "on_job_success":
      return deriveFlow(job as FlowJob);
    default:
      throw new Error(`Got unrecognised job: ${JSON.stringify(job)}`);
  }
}

export function toFlow(projectSpace: ProjectSpace): NodesAndEdges {
  if (projectSpace.jobs.length == 0) {
    return [[], []];
  }

  const [nodes, edges] = projectSpace.jobs.reduce<NodesAndEdges>(
    ([nodes, edges], job: Job) => {
      const [n, e] = deriveNodesWithEdges(job);

      return [
        [...nodes, ...n],
        [...edges, ...e],
      ];
    },
    [[], []]
  );

  const positionFactory = createPositionFactory(nodes, edges);

  return [nodes.map((n) => ({ ...n, position: positionFactory(n.id) })), edges];
}
