import Koa from 'koa';
import type { ServerState } from './server';

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

// An attempt object returned by Lightning
export type Attempt = {
  id: string;
  dataclip_id: string;
  starting_node_id: string;

  triggers: Node[];
  jobs: Node[];
  edges: Edge[];

  options?: Record<string, any>; // TODO type the expected options
};

export type LightningEvents = 'log' | 'attempt-complete';

export type DataClip = any;

export type DevServer = Koa & {
  state: ServerState;
  addCredential(id: string, cred: Credential): void;
  addDataclip(id: string, data: DataClip): void;
  enqueueAttempt(attempt: Attempt): void;
  destroy: () => void;
  getAttempt(id: string): Attempt;
  getCredential(id: string): Credential;
  getDataclip(id: string): DataClip;
  getQueueLength(): number;
  getResult(attemptId: string): any;
  getState(): ServerState;
  on(event: LightningEvents, fn: (evt: any) => void): void;
  once(event: LightningEvents, fn: (evt: any) => void): void;
  onSocketEvent(
    event: LightningEvents,
    attemptId: string,
    fn: (evt: any) => void
  ): void;
  registerAttempt(attempt: Attempt): void;
  removeAllListeners(): void;
  reset(): void;
  startAttempt(id: string): any;
  waitForResult(attemptId: string): Promise<any>;
};

/**
 * These are duplicated from the worker and subject to drift!
 * We cannot import them directly because it creates a circular build dependency mock <-> worker
 * We cannot declare an internal private types module because the generated dts will try to import from it
 *
 * The list of types is small enough right now that this is just about manageable
 **/
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

export type ClaimPayload = { demand?: number };
export type ClaimReply = { attempts: Array<ClaimAttempt> };
export type ClaimAttempt = { id: string; token: string };

export type GetAttemptPayload = void; // no payload
export type GetAttemptReply = Attempt;

export type GetCredentialPayload = { id: string };
// credential in-line, no wrapper, arbitrary data
export type GetCredentialReply = {};

export type GetDataclipPayload = { id: string };
export type GetDataClipReply = Uint8Array; // represents a json string Attempt

export type AttemptStartPayload = void; // no payload
export type AttemptStartReply = {}; // no payload

export type AttemptCompletePayload = ExitReason & {
  final_dataclip_id?: string; // TODO this will be removed soon
};
export type AttemptCompleteReply = undefined;

export type AttemptLogPayload = {
  message: Array<string | object>;
  timestamp: string;
  attempt_id: string;
  level?: string;
  source?: string; // namespace
  job_id?: string;
  step_id?: string;
};
export type AttemptLogReply = void;

export type StepStartPayload = {
  job_id: string;
  step_id: string;
  attempt_id?: string;
  input_dataclip_id?: string;
};
export type StepStartReply = void;

export type StepCompletePayload = ExitReason & {
  attempt_id?: string;
  job_id: string;
  step_id: string;
  output_dataclip?: string;
  output_dataclip_id?: string;
};
export type StepCompleteReply = void;
