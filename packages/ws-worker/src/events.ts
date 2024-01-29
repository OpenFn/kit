import { Attempt, ExitReason } from './types';

// These are worker-lightning events, used in the websocket

export const CLAIM = 'claim';

export type ClaimPayload = { demand?: number };
export type ClaimReply = { attempts: Array<ClaimAttempt> };
export type ClaimAttempt = { id: string; token: string };

export const GET_RUN = 'fetch:run';
export type GetAttemptPayload = void; // no payload
export type GetAttemptReply = Attempt;

export const GET_CREDENTIAL = 'fetch:credential';
export type GetCredentialPayload = { id: string };
// credential in-line, no wrapper, arbitrary data
export type GetCredentialReply = {};

export const GET_DATACLIP = 'fetch:dataclip';
export type GetDataclipPayload = { id: string };
export type GetDataClipReply = Uint8Array; // represents a json string Attempt

export const RUN_START = 'run:start'; // attemptId, timestamp
export type AttemptStartPayload = void; // no payload
export type AttemptStartReply = {}; // no payload

export const RUN_COMPLETE = 'run:complete'; // attemptId, timestamp, result, stats
export type AttemptCompletePayload = ExitReason & {
  final_dataclip_id?: string; // TODO this will be removed soon
};
export type AttemptCompleteReply = undefined;

export const RUN_LOG = 'run:log'; // level, namespace (job,runtime,adaptor), message, time
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

export const STEP_START = 'step:start';
export type StepStartPayload = {
  job_id: string;
  step_id: string;
  attempt_id?: string;
  input_dataclip_id?: string;
  versions: Record<string, string>;
};
export type StepStartReply = void;

export const STEP_COMPLETE = 'step:complete';
export type StepCompletePayload = ExitReason & {
  attempt_id?: string;
  job_id: string;
  step_id: string;
  output_dataclip?: string;
  output_dataclip_id?: string;
};
export type StepCompleteReply = void;

// These are internal server events
// Explicitly (and awkwardly) namespaced to avoid confusion

export const INTERNAL_ATTEMPT_COMPLETE = 'server:attempt-complete';
