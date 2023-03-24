export type Credential = Record<string, any>;

export type State = {
  data: {
    [key: string]: any;
  };
  configuration?: {
    [key: string]: any;
  };

  // technically there should be nothing here
  [key: string]: any;
};

// An attempt object returned by Lightning
// Lightning will build this wfrom a Workflow and Attempt
export type LightningAttempt = {
  id: string;
  input: Omit<State, 'configuration'>; // initial state
  plan: LightningJob[];

  // these will probably be included by lightning but we don't care here
  projectId: string;
  status: string;
  worker: string;
};

export type LightningJob = {
  adaptor: string;
  expression: string; // the code we actually want to execute. Could be lazy loaded
  credential: id;

  upstream:
    | LightningJob // shorthand for { default }
    | {
        success: LightningJob;
        error: LightningJob;
        default: LightningJob;
      };
};

type RuntimeExecutionPlanID = string;

// TODO this type should later be imported from the runtime
type JobPlan = {
  id: string;
  adaptor: string;
  expression: string; // the code we actually want to execute. Could be lazy loaded
  credential: string | object; // credential can be inline or lazy loaded
  state?: Omit<State, 'configuration'>; // initial state

  upstream:
    | JobPlanID // shorthand for { default }
    | {
        success: JobPlanID;
        error: JobPlanID;
        default: JobPlanID;
      };
};

// A runtime manager execution plan
export type ExecutionPlan = {
  id: string; // UUID for this plan

  // should we save the initial and resulting status?
  // Should we have a status here, is this a living thing?

  plan: JobPlan[]; // TODO this type should later be imported from the runtime
};

export type Xplan = ExecutionPlan;
