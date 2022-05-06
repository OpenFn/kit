import { digl } from "@crinkles/digl";
import { Job, NodesAndEdges, FlowJob, ProjectSpace } from "./types";

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
        animated: true,
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

  const label =
    job.trigger.type == "on_job_failure" ? "On Failure" : "On Success";
  const className =
    job.trigger.type == "on_job_failure" ? "fail-stroke" : "success-stroke";

  const edge = {
    id: `${job.trigger.upstreamJob}->${job.id}`,
    source: job.trigger.upstreamJob,
    target: jobNode.id,
    labelShowBg: false,
    className,
    label,
  };

  return [[jobNode], [edge]];
}

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

  // TODO: set type to "output" on node where there is no edge with it's id as a source
  const positionFactory = createPositionFactory(nodes, edges);

  return [nodes.map((n) => ({ ...n, position: positionFactory(n.id) })), edges];
}
