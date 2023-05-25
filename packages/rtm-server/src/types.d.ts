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

export type Node = {
  id: string;
  body?: string;
  adaptor?: string;
  credential?: any; // TODO tighten this up, string or object
  type?: 'webhook' | 'cron'; // trigger only
};

export interface Edge {
  id: string;
  source_job_id?: string;
  source_trigger_id?: string;
  target_job_id: string;
  name?: string;
  condition?: string;
  error_path?: boolean;
  errors?: any;
}

// An attempt object returned by Lightning
// We may later drop this abstraction and just accept an excecution plan directly
export type Attempt = {
  id: string;

  triggers: Node[];
  jobs: Node[];
  edges: Edge[];

  // these will probably be included by lightning but we don't care here
  projectId?: string;
  status?: string;
  worker?: string;
};

// type RuntimeExecutionPlanID = string;

// type JobEdge = {
//   condition?: string; // Javascript expression (function body, not function)
//   label?: string;
// };

// // TODO this type should later be imported from the runtime
// // Well, it's not quite the same is it, because eg credential can be a string
// type JobNode = {
//   id?: string;

//   adaptor?: string;

//   expression?: string | Operation[]; // the code we actually want to execute. Can be a path.

//   configuration?: object | string;
//   data?: State['data'] | string; // default state (globals)

//   next?: string | Record<JobNodeID, true | JobEdge>;
// };

// // Note that if the runtime itself is capable of calling an endpoint
// // To fetch credentials (and state?) just-in-time, then this is just a
// // Runtime Exeuction Plan, and we can import it. This is nicer tbh.
// export type ExecutionPlan = {
//   id: string; // UUID for this plan

//   start?: JobNodeID;

//   plan: JobNode[]; // TODO this type should later be imported from the runtime
// };
