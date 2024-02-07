/**
 * Type definitions for Lightning and Worker interfaces
 *
 * This is the lightning-worker contract
 *
 * It is helpful to have these in the lexicon to avoid a circular dependency between lightning and the worker
 * It's also kinda nice that the contract isn't in the worker itself, it's on neutral ground
 */
// An run object returned by Lightning
export type Run = {
  id: string;
  dataclip_id: string;
  starting_node_id: string;

  triggers: Node[];
  jobs: Node[];
  edges: Edge[];

  options?: Record<string, any>; // TODO type the expected options
};

// TODO rename to step
// maybe also split into jobs and triggers
export type Node = {
  id: string;
  body?: string;
  adaptor?: string;
  credential?: any; // TODO tighten this up, string or object
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
}

export type DataClip = object;

export type Credential = object;

export type ExitReasonStrings =
  | 'success'
  | 'fail'
  | 'crash'
  | 'kill'
  | 'cancel'
  | 'exception';

export type CONNECT = 'socket:connect';

// client left or joined a channel
export type CHANNEL_JOIN = 'socket:channel-join';
export type CHANNEL_LEAVE = 'socket:channel-leave';

// Queue Channel

// This is the event name
export type CLAIM = 'claim';

// This is the payload in the message sent to lightning
export type ClaimPayload = { demand?: number };

// This is the response from lightning
export type ClaimReply = { runs: Array<ClaimRun> };
export type ClaimRun = { id: string; token: string };

// Run channel

export type GET_PLAN = 'fetch:plan';
export type GET_CREDENTIAL = 'fetch:credential';
export type GET_DATACLIP = 'fetch:dataclip';
export type RUN_START = 'run:start';
export type RUN_COMPLETE = 'run:complete';
export type RUN_LOG = 'run:log';
export type STEP_START = 'step:start';
export type STEP_COMPLETE = 'step:complete';

export type ExitReason = {
  reason: ExitReasonStrings;
  error_message: string | null;
  error_type: string | null;
};

export type GetPlanPayload = void; // no payload
export type GetPlanReply = Run;

export type GetCredentialPayload = { id: string };
// credential in-line, no wrapper, arbitrary data
export type GetCredentialReply = {};

export type GetDataclipPayload = { id: string };
export type GetDataClipReply = Uint8Array; // represents a json string Run

export type RunStartPayload = void; // no payload
export type RunStartReply = {}; // no payload

export type RunCompletePayload = ExitReason & {
  final_dataclip_id?: string; // TODO this will be removed soon
};
export type RunCompleteReply = undefined;

export type RunLogPayload = {
  message: Array<string | object>;
  timestamp: string;
  run_id: string;
  level?: string;
  source?: string; // namespace
  job_id?: string;
  step_id?: string;
};
export type RunLogReply = void;

export type StepStartPayload = {
  job_id: string;
  step_id: string;
  run_id?: string;
  input_dataclip_id?: string;
};
export type StepStartReply = void;

export type StepCompletePayload = ExitReason & {
  run_id?: string;
  job_id: string;
  step_id: string;
  output_dataclip?: string;
  output_dataclip_id?: string;
};
export type StepCompleteReply = void;
