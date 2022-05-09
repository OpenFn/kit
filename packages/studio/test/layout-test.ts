import test from "ava";
import { toElkNode, toFlow } from "../src/layout";
import { WebhookJob } from "./helpers";

test("toElkNode for a webhook job", (t) => {
  const graph = toElkNode({ jobs: [WebhookJob({ name: "Job A" })] });
  const expected = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "elk.mrtree",
      "elk.direction": "DOWN",
      "elk.alignment": "RIGHT",
      "spacing.nodeNode": "70",
      "spacing.nodeNodeBetweenLayers": "45",
      "spacing.edgeNode": "25",
      "spacing.edgeNodeBetweenLayers": "20",
      "spacing.edgeEdge": "20",
      "spacing.edgeEdgeBetweenLayers": "15",
    },
    children: [
      {
        id: "job-a-webhook",
        width: 150,
        height: 50,
        properties: { label: "Webhook", type: "input" },
        children: [],
        edges: [],
      },
      {
        id: "job-a",
        width: 150,
        height: 50,
        layoutOptions: {
          "elk.direction": "DOWN",
          "elk.padding": "[top=35,left=10.0,bottom=10.0,right=10.0]",
        },
        properties: { label: "Job A" },
        children: [],
        edges: [],
      },
    ],
    edges: [
      {
        id: "job-a-webhook->job-a",
        sources: ["job-a-webhook"],
        targets: ["job-a"],
        sections: [],
      },
    ],
  };

  t.deepEqual(graph, expected);
});

test("toFlow for a webhook job", async (t) => {
  const graph = toElkNode({ jobs: [WebhookJob({ name: "Job A" })] });
  const flow = await toFlow(graph);

  const expected = {
    edges: [
      {
        id: "job-a-webhook->job-a",
        source: "job-a-webhook",
        target: "job-a",
      },
    ],
    nodes: [
      {
        data: {
          label: "Webhook",
        },
        id: "job-a-webhook",
        position: {
          x: 20,
          y: 20,
        },
        style: {
          backgroundColor: "rgba(240,240,240,0)",
          height: 50,
          width: 150,
        },
        type: "input",
      },
      {
        data: {
          label: "Job A",
        },
        id: "job-a",
        position: {
          x: 20,
          y: 140,
        },
        style: {
          backgroundColor: "rgba(240,240,240,0)",
          height: 50,
          width: 150,
        },
      },
    ],
  };

  t.deepEqual(flow, expected);
});
