export type Credential = object;

export type State = {
  data: {
    [key: string]: any;
  };
  configuration: {
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
  plan: LightningJob;

  // these will probably be included by lightning but we don't care here
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
