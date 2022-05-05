import test from "ava";
import {
  createPositionFactory,
  deriveNodesWithEdges,
  toFlow,
} from "../src/project-space";
import { OnFailJob, WebhookJob } from "./helpers";

test("createPositionFactory", (t) => {
  const nodes = [{ id: "foo" }, { id: "bar" }, { id: "3" }, { id: "4" }];
  const edges = [
    { id: "foo-bar", source: "foo", target: "bar" },
    { id: "foo-3", source: "foo", target: "3" },
    { id: "bar-4", source: "bar", target: "4" },
  ];
  const positionFactory = createPositionFactory(nodes, edges, {
    width: 1,
    height: 1,
  });

  t.deepEqual(positionFactory("foo"), { x: 0, y: 0 });
  t.deepEqual(positionFactory("bar"), { x: 1, y: 2 });
  t.deepEqual(positionFactory("3"), { x: -1, y: 2 });
  t.deepEqual(positionFactory("4"), { x: 0, y: 4 });
});

test("toFlow with no jobs", (t) => {
  const projectSpace = { jobs: [] };
  const flow = toFlow(projectSpace);

  t.deepEqual(flow, [[], []]);
});

test("deriveNodesWithEdges for a webhook job", (t) => {
  const flow = deriveNodesWithEdges(WebhookJob({ name: "Job A" }));

  t.deepEqual(flow, [
    [
      {
        data: { label: "Webhook" },
        id: "job-a-webhook",
        type: "input",
        position: { x: 0, y: 0 },
      },
      {
        data: { label: "Job A" },
        id: "job-a",
        position: { x: 0, y: 0 },
      },
    ],
    [{ id: "job-a-webhook->job-a", source: "job-a-webhook", target: "job-a" }],
  ]);
});

test("deriveNodesWithEdges for a on fail job", (t) => {
  const onFail = WebhookJob({ name: "Job A" });
  const flow = deriveNodesWithEdges(OnFailJob(onFail, { name: "Job B" }));

  t.deepEqual(flow, [
    [
      {
        data: { label: "Job B" },
        id: "job-b",
        position: { x: 0, y: 0 },
      },
    ],
    [{ id: "job-a->job-b", source: "job-a", target: "job-b" }],
  ]);
});

test("toFlow expands a webhook job to a trigger node and a job node", (t) => {
  const projectSpace = { jobs: [WebhookJob({ name: "Job A" })] };
  const flow = toFlow(projectSpace);

  t.deepEqual(flow, [
    [
      {
        data: { label: "Webhook" },
        id: "job-a-webhook",
        type: "input",
        position: { x: 0, y: 0 },
      },
      {
        data: { label: "Job A" },
        id: "job-a",
        position: { x: 0, y: 200 },
      },
    ],
    [{ id: "job-a-webhook->job-a", source: "job-a-webhook", target: "job-a" }],
  ]);
});
