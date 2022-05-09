import App from "@openfn/studio";

import React from "react";
import { createRoot } from "react-dom/client";

const projectSpace = {
  jobs: [
    {
      id: "A",
      name: "Job A",
      adaptor: "@openfn/language-salesforce@2.8.1",
      trigger: { type: "webhook" },
      operations: [
        { id: "115", label: "create", comment: "Create an object" },
        { id: "25", label: "fn", comment: "Map out new records" },
        { id: "35", label: "upsert", comment: "Upsert results" }
      ]
    },
    {
      id: "B",
      name: "Job B",
      adaptor: "@openfn/language-salesforce@0.2.2",
      trigger: { type: "on_job_failure", upstreamJob: "E" },
    },
    {
      id: "C",
      name: "Job C",
      adaptor: "@openfn/language-dhis2@0.3.5",
      trigger: { type: "on_job_success", upstreamJob: "A" },
    },
    {
      id: "E",
      name: "Job E",
      adaptor: "@openfn/language-dhis2@0.3.5",
      trigger: { type: "on_job_failure", upstreamJob: "A" },
    },
  ],
};

const root = createRoot(document.getElementById("root"));

root.render(
  <div className="h-screen w-screen">
    <div className="flex-none h-full">
      <App projectSpace={projectSpace} />
    </div>
  </div>
);


