import { assert } from "chai";
import { describe } from "mocha";
import { addDescription, renameUntitledWorkflows } from "../src/transform";
import {
  CronTrigger,
  FlowTrigger,
  ProjectSpace,
  WebhookTrigger,
} from "../dist/types";

const sampleProjectSpace = {
  jobs: [
    {
      id: "A",
      name: "Job A",
      workflowId: "wf-one",
      adaptor: "@openfn/language-salesforce@2.8.1",
      enabled: true,
      trigger: {
        type: "webhook",
        url: "https://demo.openfn.org/i/34f843bd-eb87-4833-b32a-905139534d5a",
      },
      operations: [
        { id: "115", label: "create", comment: "Create an object" },
        { id: "25", label: "fn", comment: "Map out new records" },
        { id: "35", label: "upsert", comment: "Upsert results" },
      ],
    },
    {
      id: "B",
      name: "Job B",
      workflowId: "wf-one",
      adaptor: "@openfn/language-salesforce@0.2.2",
      enabled: true,
      trigger: { type: "on_job_failure", upstreamJob: "E" },
    },
    {
      id: "D",
      name: "Job D",
      workflowId: "wf-two",
      adaptor: "@openfn/language-http@4.0.0",
      enabled: true,
      trigger: { type: "cron", expression: "* * * * *" },
    },
  ],
  workflows: [
    { name: null, id: "wf-one" },
    { name: "Workflow Two", id: "wf-two" },
  ],
};

describe("addDescription", () => {
  it("should add expected descriptions to triggers", () => {
    const { jobs } = sampleProjectSpace as ProjectSpace;
    const webhookTrigger = jobs[0].trigger as WebhookTrigger;
    const flowTrigger = jobs[1].trigger as FlowTrigger;
    const cronTrigger = jobs[2].trigger as CronTrigger;

    assert.isUndefined(webhookTrigger.description);
    assert.isUndefined(flowTrigger.description);
    assert.isUndefined(cronTrigger.description);

    const jobsWithDescriptions = addDescription(jobs);

    assert.strictEqual(
      jobsWithDescriptions[0].trigger.description,
      `When data is received at ${webhookTrigger.url}`
    );
    assert.strictEqual(jobsWithDescriptions[1].trigger.description, null);
    assert.strictEqual(
      jobsWithDescriptions[2].trigger.description,
      "Every minute"
    );
  });
});

describe("addDescription", () => {
  it("should rename workflows with null name to Untitled", () => {
    const { workflows } = sampleProjectSpace as ProjectSpace;

    assert.isNull(workflows[0].name);
    assert.isNotNull(workflows[1].name);

    const workflowsWithNames = renameUntitledWorkflows(workflows);

    assert.strictEqual(workflowsWithNames[0].name, "Untitled");
    assert.strictEqual(workflowsWithNames[1].name, workflows[1].name);
  });
});
