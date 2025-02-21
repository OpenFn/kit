import * as l from '@openfn/lexicon/lightning';

// events from lightning to workers
export const WORK_AVAILABLE = 'work-available';

// These are worker-lightning events, used in the websocket
export const CLAIM = 'claim';
export const GET_PLAN = 'fetch:plan';
export const GET_DATACLIP = 'fetch:dataclip';
export const GET_CREDENTIAL = 'fetch:credential';
export const RUN_START = 'run:start';
export const RUN_COMPLETE = 'run:complete';
export const RUN_LOG = 'run:log';
export const STEP_START = 'step:start';
export const STEP_COMPLETE = 'step:complete';
export const INTERNAL_RUN_COMPLETE = 'server:run-complete';

export type QueueEvents = {
  [CLAIM]: l.ClaimPayload;
};

export type QueueEventReplies = {
  [CLAIM]: l.ClaimReply;
};

export type RunEvents = {
  [GET_PLAN]: l.GetPlanPayload;
  [GET_CREDENTIAL]: l.GetCredentialPayload;
  [GET_DATACLIP]: l.GetDataclipPayload;
  [RUN_START]: l.RunStartPayload;
  [RUN_COMPLETE]: l.RunCompletePayload;
  [RUN_LOG]: l.RunLogPayload;
  [STEP_START]: l.StepStartPayload;
  [STEP_COMPLETE]: l.StepCompletePayload;
};

export type RunReplies = {
  [GET_PLAN]: l.GetPlanReply;
  [GET_CREDENTIAL]: l.GetCredentialReply;
  [GET_DATACLIP]: l.GetDataClipReply;
  [RUN_START]: l.RunStartReply;
  [RUN_COMPLETE]: l.RunCompleteReply;
  [RUN_LOG]: l.RunLogReply;
  [STEP_START]: l.StepStartReply;
  [STEP_COMPLETE]: l.StepCompleteReply;
};
