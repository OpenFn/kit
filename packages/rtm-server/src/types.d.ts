export type State = any;

type JobID = string;

// This job structure lets us lazily evalulate the expression quite nicely
export type JobNode = {
  id: string; // the ID is a sha of the code
  adaptor: string;

  expression?: string; // the code we actually want to execute. Could be lazy loaded
  state?: State; // should state be part of a job? Not really?

  upstream:
    | JobNode // shorthand for { default }
    | {
        success: JobNode;
        error: JobNode;
        default: JobNode;
      };
};

export type Workflow = {
  id: string; // uuid
  name?: string; // I don't think the RTM cares about this?

  // This is the initial state
  state: State | string; // inline obj or UUID (Or sha, whatever)

  // Which job do we start at?
  // This isn't neccessarily the first node
  start: JobID;

  // This is the execution plan for the workflow
  plan: JobNode[];
};

/*

We can fetch workflow by id
The workflow is a json object
Jobs and probably state objects may be lazily resolved

A workflow starts at the start and executes jobs until there are no more upstream jobs
*/
