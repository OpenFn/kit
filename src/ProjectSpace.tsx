import { Edge, Node } from "react-flow-renderer";

type WebhookTrigger = {
  type: "webhook";
};

type FlowTrigger = {
  type: "on_job_failure" | "on_job_success";
  upstreamJob: string;
};

interface Job {
  id: string;
  name: string;
  adaptor: string;
  trigger: FlowTrigger | WebhookTrigger;
}

export interface ProjectSpace {
  jobs: Job[];
  startingPoint?: { x: number; y: number };
  spacing?: number;
}

import { digl } from "@crinkles/digl";

const machine = digl({
  width: 100,
  height: 50,
  orientation: "vertical",
  shortestPath: false,
  addEmptySpots: false,
});

function createPositionFactory(
  nodes: { id: string }[],
  edges: { source: string; target: string }[]
) {
  // [["aaa"], ["bbb", "ccc"]];
  const ranks = machine.ranks(nodes[0].id, nodes, edges);

  return (nodeId: string): { x: number; y: number } => {
    const y = ranks.findIndex((rank) => {
      return rank.find((i) => i == nodeId);
    })

    console.log({y: y});
    
    return { x: 1, y: y * 100 };
  };
}

export function toFlow(projectSpace: ProjectSpace): [Node[], Edge[]] {
  const spacing = projectSpace.spacing || 100;

  const edges: Edge[] = projectSpace.jobs
    .filter((job) => {
      return "upstreamJob" in job.trigger;
    })
    .map((job) => {
      const { upstreamJob } = job.trigger as FlowTrigger;

      return {
        id: `${job.id}-${upstreamJob}`,
        source: upstreamJob,
        target: job.id,
      };
    });

  // Nodes must be sorted
  const positionFactory = createPositionFactory(projectSpace.jobs, edges);

  const nodes: Node[] = projectSpace.jobs.map((job) => {
    return {
      id: job.id,
      // type:
      data: {
        label: job.name,
      },
      position: positionFactory(job.id),
    };
  });

  console.log({ nodes, edges });

  return [nodes, edges];
}
