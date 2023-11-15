import { SanitizePolicies } from '@openfn/logger';
import type { Channel as PhxChannel } from 'phoenix';

export { Socket };

export type Credential = Record<string, any>;

export type State = {
  data: {
    [key: string]: any;
  };
  configuration?: {
    [key: string]: any;
  };
  errors?: {
    [jobId: string]: {
      type: string;
      message: string;
    };
  };

  // technically there should be nothing here
  [key: string]: any;
};

export type ExitReasonStrings =
  | 'success'
  | 'fail'
  | 'crash'
  | 'kill'
  | 'cancel'
  | 'exception';

export type ExitReason = {
  reason: ExitReasonStrings;
  error_message: string | null;
  error_type: string | null;
};

export type Node = {
  id: string;
  body?: string;
  adaptor?: string;
  credential_id?: any; // TODO tighten this up, string or object
  type?: 'webhook' | 'cron'; // trigger only
  state?: any; // Initial state / defaults
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
  enabled?: boolean;
}

// An attempt object returned by Lightning
export type Attempt = {
  id: string;
  dataclip_id: string;
  starting_node_id: string;

  triggers: Node[];
  jobs: Node[];
  edges: Edge[];

  options?: AttemptOptions;
};

export type AttemptOptions = {
  timeout?: number;
  sanitize?: SanitizePolicies;
};

// Internal server state for each attempt
export type AttemptState = {
  activeRun?: string;
  activeJob?: string;
  plan: ExecutionPlan;
  options: AttemptOptions;
  dataclips: Record<string, any>;
  // For each run, map the input ids
  // TODO better name maybe?
  inputDataclips: Record<string, string>;
  reasons: Record<string, ExitReason>;

  // final dataclip id
  lastDataclipId?: string;
};

export type CancelablePromise = Promise<void> & {
  cancel: () => void;
};

type ReceiveHook = {
  receive: (
    status: 'ok' | 'timeout' | 'error',
    callback: (payload?: any) => void
  ) => ReceiveHook;
};

// export declare class Socket extends PhxSocket {
//   constructor(endpoint: string, options: { params: any });
//   onOpen(callback: () => void): void;
//   connect(): void;
//   channel(channelName: string, params: any): Channel;
// }

export interface Channel extends PhxChannel {
  // on: (event: string, fn: (evt: any) => void) => void;

  // TODO it would be super nice to infer the event from the payload
  push: <P = any>(event: string, payload?: P) => ReceiveHook;
  // join: () => ReceiveHook;
}
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
