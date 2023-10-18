// TODO remove ths file in favour of types

// TODO mayberename event constants
import { JSONLog } from '@openfn/logger';

// Top level API events - these are what the engine publishes externally
// should it just be start, log, job-start, job-complete, end etc?
// What about engine-level logging? CLI-level stuff?
export const WORKFLOW_START = 'workflow-start';

export const WORKFLOW_COMPLETE = 'workflow-complete';

export const WORKFLOW_ERROR = 'workflow-error';

export const JOB_START = 'job-start';

export const JOB_COMPLETE = 'job-complete';

export const WORKFLOW_LOG = 'workflow-log';

export const WORKFLOW_EDGE_RESOLVED = 'workflow-edge-resolved';

export const AUTOINSTALL_COMPLETE = 'autoinstall-complete';

export const AUTOINSTALL_ERROR = 'autoinstall-error';

export type EventMap = {
  [WORKFLOW_START]: WorkflowStartPayload;
  [WORKFLOW_COMPLETE]: WorkflowCompletePayload;
  [JOB_START]: JobStartPayload;
  [JOB_COMPLETE]: JobCompletePayload;
  [WORKFLOW_LOG]: WorkerLogPayload;
  [WORKFLOW_ERROR]: WorkflowErrorPayload;
  [AUTOINSTALL_COMPLETE]: AutoinstallCompletePayload;
  [AUTOINSTALL_ERROR]: AutoinstallErrorPayload;
};

export type ExternalEvents = keyof EventMap;

interface ExternalEvent {
  threadId?: string;
  workflowId: string;
}

export interface WorkflowStartPayload extends ExternalEvent {}

export interface WorkflowCompletePayload extends ExternalEvent {
  state: any;
  duration: number;
}

export interface WorkflowErrorPayload extends ExternalEvent {
  type: string;
  message: string;
}

export interface JobStartPayload extends ExternalEvent {
  jobId: string;
}

export interface JobCompletePayload extends ExternalEvent {
  jobId: string;
  duration: number;
  state: any; // the result state
}

export interface WorkerLogPayload extends ExternalEvent, JSONLog {}

export interface EdgeResolvedPayload extends ExternalEvent {
  edgeId: string; // interesting, we don't really have this yet. Is index more appropriate? key? yeah, it's target node basically
  result: boolean;
}

export interface AutoinstallCompletePayload extends ExternalEvent {
  module: string;
  version: string;
  duration: number;
}

export interface AutoinstallErrorPayload extends ExternalEvent {
  module: string;
  version: string;
  duration: number;
  message: string;
}
