# @openfn/workflow-diagram

Diagram component to render OpenFn Workflows.

Using [ReactFlow](https://reactflow.dev/) and ELKjs.

## Usage

```jsx
import WorkflowDiagram from "@openfn/workflow-diagram";

// If you want to include the bundled CSS.
import "@openfn/workflow-diagram/index.css";

let exampleData = {
  jobs: [
    {
      id: "A",
      name: "Job A",
      workflowId: "wf-one",
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
      workflowId: "wf-one",
      adaptor: "@openfn/language-salesforce@0.2.2",
      trigger: { type: "on_job_failure", upstreamJob: "E" },
    },
    {
      id: "C",
      name: "Job C",
      workflowId: "wf-one",
      adaptor: "@openfn/language-dhis2@0.3.5",
      trigger: { type: "on_job_success", upstreamJob: "A" },
    },
    {
      id: "E",
      name: "Job E",
      workflowId: "wf-one",
      adaptor: "@openfn/language-dhis2@0.3.5",
      trigger: { type: "on_job_failure", upstreamJob: "A" },
    },
  ],
  workflows: [
    {
      name: "my workflow",
      id: "wf-one",
    },
  ],
};

<WorkflowDiagram projectSpace={exampleData} onNodeClick={clickHandler} />;
```

> ReactFlow needs to know the size of the parent DOM element in order to draw
> the diagram, ensure the component is wrapped in an element with a known
> height.
> _See: https://reactflow.dev/docs/guides/troubleshooting/#the-react-flow-parent-container-needs-a-width-and-a-height-to-render-the-graph_

**Handling Click Events**

### `onNodeClick` _optional_

When a node is clicked on, gets called with `(event, data)`.

### `onPaneClick` _optional_

When the pane is clicked, useful for tracking 'unselecting' a node.
