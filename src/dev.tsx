import React from "react";
import App from "./index";
import { createRoot } from "react-dom/client";

const projectSpace = {
  jobs: [
    {
      id: "aaa",
      name: "Job A",
      adaptor: "@openfn/language-salesforce@2.8.1",
      trigger: { type: 'webhook' },
    },
    {
      id: "bbb",
      name: "Job B",
      adaptor: "@openfn/language-salesforce@0.2.2",
      trigger: { type: "on_job_failure", upstreamJob: "111" },
    },
    {
      id: "ccc",
      name: "Job C",
      adaptor: "@openfn/language-dhis2@0.3.5",
      trigger: { type: "on_job_success", upstreamJob: "aaa" },
    },
    {
      id: "111",
      name: "Job E",
      adaptor: "@openfn/language-dhis2@0.3.5",
      trigger: { type: "on_job_failure", upstreamJob: "aaa" },
    },
  ],
};

const root = createRoot(document.getElementById("root"));

root.render(
  <div className="h-screen w-screen">
    <div className="flex h-full">
      <div className="flex-none bg-slate-500 w-14 h-full"></div>
      <div className="flex-1 bg-slate-50">
        <App projectSpace={projectSpace} />
      </div>
    </div>
  </div>
);
