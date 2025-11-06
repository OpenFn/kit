import type { LogLevel, SanitizePolicies } from '@openfn/logger';
import { LegacyJob, State } from './core';

export const API_VERSION: number;

type StepId = string;

type TimeInMicroSeconds = string;

/**
 * Type definitions for Lightning and Worker interfaces
 *
 * This is the lightning-worker contract
 *
 * It is helpful to have these in the lexicon to avoid a circular dependency between lightning and the worker
 * It's also kinda nice that the contract isn't in the worker itself, it's on neutral ground
 */

/**
 * The Lightning Plan is the data structure sent by lightning in response
 * to the fetch:plan event. It represents a single Run, or an execution
 * of a workflow given some input dataclip.
 *
 * This structure is converted by the Worker into a runtime ExecutionPlan (as found in Core)
 */
export type LightningPlan = {
  /** The Lightning UUID for this Run (not the same as the workflow id/UUID) */
  id: string;

  /** The human readable name of the workflow. Not currently sent by Lightning. */
  name?: string;

  dataclip_id: string;
  starting_node_id: string;

  triggers: LightningTrigger[];
  jobs: LightningJob[];
  edges: LightningEdge[];

  options?: LightningPlanOptions;

  globals?: string;
};

/**
 * These are options that can be sent to the worker with an execution plan
 * They broadly map to the Workflow Options that are fed straight into the runtime
 * and saved to the plan itself
 * (although at the time of writing timeout is handled by the worker, not the runtime)
 */
export type LightningPlanOptions = {
  run_timeout_ms?: number;
  sanitize?: SanitizePolicies;
  start?: StepId;
  output_dataclips?: boolean;

  run_memory_limit_mb?: number;
  payload_limit_mb?: number;
  job_log_level?: LogLevel;
};

/**
 * This is a Job or Trigger node in a Lightning plan,
 * AKA a Step.
 *
 * Sticking with the Node/Edge semantics to help distinguish the
 * Lightning and runtime typings
 */
export interface LightningNode {
  id: string;
  name?: string;
  body?: string;
  adaptor?: string;
  credential?: any;
  credential_id?: string;
  state?: State;
}

export interface LightningTrigger extends LightningNode {
  type: 'webhook' | 'cron';
}

export interface LightningJob extends LightningNode {
  adaptor: string;
}

/**
 * This is a Path (or link) between two Jobs in a Plan.
 *
 * Sticking with the Node/Edge semantics to help distinguish the
 * Lightning and runtime typings
 */
export interface LightningEdge {
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

export type DataClip = Record<string, any>;

export type Credential = Record<string, any>;

// TODO export reason strings from this repo
// and explain what each reason means
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
export type ClaimPayload = { demand?: number; worker_name: string | null };

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
export type GetPlanReply = LightningPlan;

export type GetCredentialPayload = { id: string };
// credential in-line, no wrapper, arbitrary data
export type GetCredentialReply = {};

export type GetDataclipPayload = { id: string };
export type GetDataClipReply = Uint8Array; // represents a json string Run

export type RunStartPayload = {
  timestamp: TimeInMicroSeconds;
}; // no payload
export type RunStartReply = {}; // no payload

export type RunCompletePayload = ExitReason & {
  timestamp: TimeInMicroSeconds;
  final_state?: any; // The aggregated final state from the workflow (handles branching)
};
export type RunCompleteReply = undefined;

export type RunLogPayload = {
  message: Array<string | object>;
  timestamp: TimeInMicroSeconds;
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
  timestamp: TimeInMicroSeconds;
};
export type StepStartReply = void;

export type StepCompletePayload = ExitReason & {
  run_id?: string;
  job_id: string;
  step_id: string;
  output_dataclip?: string;
  output_dataclip_id?: string;
  output_dataclip_error?: 'DATACLIP_TOO_LARGE';
  thread_id?: string;
  mem: {
    job: number;
    system: number;
  };
  duration: number;
  timestamp: TimeInMicroSeconds;
};
export type StepCompleteReply = void;

// This needs to describe the data structures coming out of lightning
// they've been copied out of deploy but they don't seem accurate
export namespace Provisioner {
  export type Project = Project_v1;

  export interface Project_v1 {
    id: string;
    name: string;
    description: string | null;

    workflows: Workflow[];
    concurrency?: any; // TODO

    // TODO typing isn't quite right here either
    //project_credentials: Record<string | symbol, Credential>;
    project_credentials: any[];

    // this is clearly wrong?
    //collections: Record<string | symbol, Collection>;
    // should be an array of something?
    collections: any[];

    // serverside metadata
    inserted_at?: string;
    updated_at?: string;
    scheduled_deletion: string | null;

    // app options
    allow_support_access?: boolean;
    requires_mfa?: boolean;
    retention_policy?: string;
    history_retention_period: string | null;
    dataclip_retention_period: string | null;
  }

  export interface Workflow {
    id: string;
    name: string;
    jobs: Job[];
    triggers: Trigger[];
    edges: Edge[];
    delete?: boolean;
    project_id?: string;

    concurrency?: null; // TODO
    lock_version?: number;
    inserted_at?: string;
    updated_at?: string;
    deleted_at: string | null;
  }

  export type Collection = {
    id: string;
    name: string;
    delete?: boolean;
  };

  export type Credential = {
    id: string;
    name: string;
    owner: string;
  };

  export type Job = {
    id: string;
    name: string;
    adaptor: string;
    body: string;
    project_credential_id: string | null;
    keychain_credential_id: string | null;
    delete?: boolean;
  };

  export type Trigger = {
    id: string;
    type: string;
    cron_expression?: string;
    delete?: boolean;
    enabled?: boolean;
    kafka_configuration?: KafkaConfiguration;
  };

  export type Edge = {
    id: string;
    condition_type: string;
    condition_expression?: string | null;
    condition_label?: string | null;
    source_job_id?: string | null;
    source_trigger_id: string | null;
    target_job_id: string;
    enabled?: boolean;
  };

  export type KafkaConfiguration = {
    hosts: [string, string];
    topics: string[];
    initial_offset_reset_policy: string;
    connect_timeout: number;
  };
}
