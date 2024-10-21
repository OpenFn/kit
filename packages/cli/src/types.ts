// the executionPLan for the CLI is a bit differnt to the runtime's perspective

import { Trigger, UUID, WorkflowOptions } from '@openfn/lexicon';

// Ie config can be a string
export type JobNodeID = string;

export type OldCLIWorkflow = {
  id?: string; // UUID for this plan
  start?: JobNodeID;
  jobs: CLIJobNode[];
};

export type CLIExecutionPlan = {
  id?: string;
  options: WorkflowOptions;
  workflow: {
    id?: UUID;
    name?: string;
    steps: Array<CLIJobNode | Trigger>;
  };
};

export type CLIJobNode = {
  id?: string;
  expression?: string; // path or expression
  configuration?: string | object; // path or credential object
  data?: any;
  next?: string | Record<JobNodeID, true | CLIJobEdge>;

  // We can accept a single adaptor or multiple
  // The CLI will convert it to adaptors as an array
  adaptor?: string;
  adaptors?: string[];
};

export type CLIJobEdge = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string;
};
