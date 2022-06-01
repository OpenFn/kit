# @openfn/workflow-diagram

Diagram component to render OpenFn Workflows.

Using [ReactFlow](https://reactflow.dev/) and ELKjs.

## Usage

```jsx
import WorkflowDiagram from "@openfn/workflow-diagram";

let exampleData = {
  jobs: [
    {
      id: "A",
      name: "Job A",
      adaptor: "@openfn/language-salesforce@2.8.1",
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

<WorkflowDiagram projectSpace={exampleData} />;
```

> ReactFlow needs to know the size of the parent DOM element in order to draw
> the diagram, ensure the component is wrapped in an element with a known
> height.
> _See: https://reactflow.dev/docs/guides/troubleshooting/#the-react-flow-parent-container-needs-a-width-and-a-height-to-render-the-graph_
