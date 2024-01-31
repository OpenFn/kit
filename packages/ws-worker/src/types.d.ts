import { SanitizePolicies } from '@openfn/logger';
import type { Channel as PhxChannel } from 'phoenix';
import type { ExecutionPlan } from '@openfn/runtime';

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
  credential?: object;
  credential_id?: string;
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
  // This is what Lightning will ssend us
  // Note that this is the NEW terminology, so it's the timeout  for the whole "attempt"
  runTimeout?: number;

  // this is the internal old terminology, which will be deprecated soon
  attemptTimeoutMs?: number;

  attemptTimeout?: number; // deprecated

  // deprecated alias for timeout. Maps to "attemptTimeout" internally
  timeout?: number;

  sanitize?: SanitizePolicies;
};

// Internal server state for each attempt
export type AttemptState = {
  activeStep?: string;
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

export interface Channel extends PhxChannel {
  // on: (event: string, fn: (evt: any) => void) => void;

  // TODO it would be super nice to infer the event from the payload
  push: <P = any>(event: string, payload?: P) => ReceiveHook;
  // join: () => ReceiveHook;
}

// override the JSON log typing because the log message
// is always JSON encoded in a string
export type JSONLog = Omit<JSONLog, 'message'> & {
  message: string;
};
