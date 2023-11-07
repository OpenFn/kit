import { Attempt } from './types';

// track socket event names as constants to keep refactoring easier

export const CLAIM = 'claim';

// this is the lightning payload
// TODO why are the types in all caps...?
export type CLAIM_PAYLOAD = { demand?: number };
export type CLAIM_REPLY = { attempts: Array<CLAIM_ATTEMPT> };
export type CLAIM_ATTEMPT = { id: string; token: string };

export const GET_ATTEMPT = 'fetch:attempt';
export type GET_ATTEMPT_PAYLOAD = void; // no payload
export type GET_ATTEMPT_REPLY = Attempt;

export const GET_CREDENTIAL = 'fetch:credential';
export type GET_CREDENTIAL_PAYLOAD = { id: string };
// credential in-line, no wrapper, arbitrary data
export type GET_CREDENTIAL_REPLY = {};

export const GET_DATACLIP = 'fetch:dataclip';
export type GET_DATACLIP_PAYLOAD = { id: string };
export type GET_DATACLIP_REPLY = Uint8Array; // represents a json string Attempt

export const ATTEMPT_START = 'attempt:start'; // attemptId, timestamp
export type ATTEMPT_START_PAYLOAD = void; // no payload
export type ATTEMPT_START_REPLY = void; // no payload

export const ATTEMPT_COMPLETE = 'attempt:complete'; // attemptId, timestamp, result, stats
export type ATTEMPT_COMPLETE_PAYLOAD = {
  final_dataclip_id: string;
  status: 'success' | 'fail' | 'crash' | 'timeout';
  stats?: any;
}; // TODO dataclip -> result? output_dataclip?
export type ATTEMPT_COMPLETE_REPLY = undefined;

export const ATTEMPT_LOG = 'attempt:log'; // level, namespace (job,runtime,adaptor), message, time
export type ATTEMPT_LOG_PAYLOAD = {
  message: Array<string | object>;
  timestamp: string; // Tiemstamp in microseconds (13 digits)
  attempt_id: string;
  level?: string;
  source?: string; // namespace
  job_id?: string;
  run_id?: string;
};
export type ATTEMPT_LOG_REPLY = void;

export const RUN_START = 'run:start';
export type RUN_START_PAYLOAD = {
  job_id: string;
  run_id: string;
  attempt_id?: string;
  input_dataclip_id?: string; //hmm
};
export type RUN_START_REPLY = void;

export const RUN_COMPLETE = 'run:complete';
export type RUN_COMPLETE_PAYLOAD = {
  attempt_id?: string;
  job_id: string;
  run_id: string;
  output_dataclip?: string;
  output_dataclip_id?: string;
};
export type RUN_COMPLETE_REPLY = void;
