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

export type LightningEvents = 'log' | 'run-complete';

export type DataClip = any;

export type DevServer = Koa & {
  state: ServerState;
  addCredential(id: string, cred: Credential): void;
  addDataclip(id: string, data: DataClip): void;
  enqueueRun(run: Run): void;
  destroy: () => void;
  getRun(id: string): Run;
  getCredential(id: string): Credential;
  getDataclip(id: string): DataClip;
  getQueueLength(): number;
  getResult(runId: string): any;
  getState(): ServerState;
  on(event: LightningEvents, fn: (evt: any) => void): void;
  once(event: LightningEvents, fn: (evt: any) => void): void;
  onSocketEvent(
    event: LightningEvents,
    runId: string,
    fn: (evt: any) => void
  ): void;
  registerRun(run: Run): void;
  removeAllListeners(): void;
  reset(): void;
  startRun(id: string): any;
  waitForResult(runId: string): Promise<any>;
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
export type ClaimReply = { runs: Array<ClaimRun> };
export type ClaimRun = { id: string; token: string };

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
