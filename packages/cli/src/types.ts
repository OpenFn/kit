import { WorkflowOptions } from '@openfn/lexicon';
import type { ExecutionPlan, Job, Trigger } from '@openfn/runtime';

export type JobNodeID = string;

export type OldCLIWorkflow = {
  id?: string;
  start?: JobNodeID;
  jobs: CLIJobNode[];
};

// Input-format wrapper around the runtime ExecutionPlan.
// Accepts singular `adaptor` on jobs (normalized to `adaptors[]` by ensureAdaptors
// before handing to the runtime) and adds the CLI-only collectionsEndpoint option.
export type CLIExecutionPlan = Omit<ExecutionPlan, 'workflow' | 'options'> & {
  options?: WorkflowOptions & {
    collectionsEndpoint?: string;
  };
  workflow: Omit<ExecutionPlan['workflow'], 'steps'> & {
    steps: Array<CLIJobNode | Trigger>;
  };
};

// Loose input variant of Job: `adaptor` (singular) is normalized to `adaptors[]`
// by the CLI before the plan reaches the runtime.
export type CLIJobNode = Job & {
  data?: any;
  adaptor?: string;
};

export type CLIJobEdge = {
  condition?: string;
  label?: string;
};
