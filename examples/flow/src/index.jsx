import WorkflowDiagram from "@openfn/workflow-diagram";

import React from "react";
import { createRoot } from "react-dom/client";

import "./app.css";

const projectSpace = {
  jobs: [
    {
      id: "A",
      name: "Job A",
      workflowId: "wf-one",
      adaptor: "@openfn/language-salesforce@2.8.1",
      enabled: true,
      trigger: { type: "webhook" },
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
      id: "C",
      name: "Job C",
      workflowId: "wf-one",
      adaptor: "@openfn/language-dhis2@0.3.5",
      enabled: true,
      trigger: { type: "on_job_success", upstreamJob: "A" },
    },
    {
      id: "E",
      name: "Job E",
      workflowId: "wf-one",
      adaptor: "@openfn/language-dhis2@0.3.5",
      trigger: { type: "on_job_failure", upstreamJob: "A" },
      enabled: true,
      operations: [
        { id: "29", label: "fn", comment: "Map out new records" },
        { id: "39", label: "upsert", comment: "Upsert results" },
      ],
    },
    {
      id: "D",
      name: "Job D",
      workflowId: "wf-two",
      adaptor: "@openfn/language-http@4.0.0",
      enabled: true,
      trigger: { type: "cron" },
    },
  ],
  workflows: [
    { name: "Workflow One", id: "wf-one" },
    { name: "Workflow Two", id: "wf-two" },
  ],
};

const root = createRoot(document.getElementById("root"));

function onNodeClick(_event, node) {
  console.log("Clicked Node:", node);
}

function onPaneClick(event) {
  console.log("Clicked pane:", event);
}

root.render(
  <div className="h-screen w-screen antialiased">
    <div className="flex-none h-full bg-gray-100">
      <WorkflowDiagram
        projectSpace={projectSpace}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      />
    </div>
  </div>
);
