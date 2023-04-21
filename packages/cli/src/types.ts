// the executionPLan for the CLI is a bit differnt to the runtime's perspective
// Ie config can be a string
export type JobNodeID = string;

export type CLIExecutionPlan = {
  id?: string; // UUID for this plan
  start?: JobNodeID;
  jobs: CLIJobNode[];
};

export type CLIJobNode = {
  id?: string;
  adaptor?: string;
  expression?: string; // path or expression
  configuration?: string | object; // path or credential object
  data?: any;

  next?: string | Record<JobNodeID, true | CLIJobEdge>;
};

export type CLIJobEdge = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string;
};
