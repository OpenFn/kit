import { Attempt } from './types';

/**
 * These events are copied out of ws-worker
 * There is a danger of them diverging
 */

export const CLAIM = 'claim';

export type ClaimPayload = { demand?: number };
export type ClaimReply = { attempts: Array<ClaimAttempt> };
export type ClaimAttempt = { id: string; token: string };

export const GET_ATTEMPT = 'fetch:attempt';
export type GetAttemptPayload = void; // no payload
export type GetAttemptReply = Attempt;

export const GET_CREDENTIAL = 'fetch:credential';
export type GetCredentialPayload = { id: string };
// credential in-line, no wrapper, arbitrary data
export type GetCredentialReply = {};

export const GET_DATACLIP = 'fetch:dataclip';
export type GetDataclipPayload = { id: string };
export type GetDataClipReply = Uint8Array; // represents a json string Attempt

export const ATTEMPT_START = 'attempt:start'; // attemptId, timestamp
export type AttemptStartPayload = void; // no payload
export type AttemptStartReply = void; // no payload

export const ATTEMPT_COMPLETE = 'attempt:complete'; // attemptId, timestamp, result, stats
export type AttemptCompletePayload = {
  final_dataclip_id: string;
  status: 'success' | 'fail' | 'crash' | 'timeout';
  stats?: any;
}; // TODO dataclip -> result? output_dataclip?
export type AttemptCompleteReply = undefined;

export const ATTEMPT_LOG = 'attempt:log'; // level, namespace (job,runtime,adaptor), message, time
export type AttemptLogPayload = {
  message: Array<string | object>;
  timestamp: number;
  attempt_id: string;
  level?: string;
  source?: string; // namespace
  job_id?: string;
  run_id?: string;
};
export type AttemptLogReply = void;

export const RUN_START = 'run:start';
export type RunStart = {
  job_id: string;
  run_id: string;
  attempt_id?: string;
  input_dataclip_id?: string; //hmm
};
export type RunStartReply = void;

export const RUN_COMPLETE = 'run:complete';
export type RunCompletePayload = {
  attempt_id?: string;
  job_id: string;
  run_id: string;
  output_dataclip?: string;
  output_dataclip_id?: string;
};
export type RunCompleteReply = void;
