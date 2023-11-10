/**
 * Events published by the inner worker
 */

import { JSONLog } from '@openfn/logger';

// These events are basically duplicates of the externally published ones
// (ie those consumed by the lightning worker)
// But I want them to be explicity named and typed to avoid confusion
// Otherwise when you're looking an event, it's hard to know if it's internal
// or external

export const WORKFLOW_START = 'worker:workflow-start';

export const WORKFLOW_COMPLETE = 'worker:workflow-complete';

export const JOB_START = 'worker:job-start';

export const JOB_ERROR = 'worker:job-error';

export const JOB_COMPLETE = 'worker:job-complete';

export const ERROR = 'worker:error';

export const LOG = 'worker:log';

interface InternalEvent {
  type: WorkerEvents;
  workflowId: string;
  threadId: string;
}

export interface WorkflowStartEvent extends InternalEvent {}

export interface WorkflowCompleteEvent extends InternalEvent {
  state: any;
}

export interface JobStartEvent extends InternalEvent {
  jobId: string;
}

export interface JobCompleteEvent extends InternalEvent {
  jobId: string;
  state: any;
  duration: number;
}

export interface JobErrorEvent extends InternalEvent {
  jobId: string;
  state: any;
  error: any; // TODO this should be one of our errors
  duration: number;
}

export interface LogEvent extends InternalEvent {
  message: JSONLog;
}

export interface ErrorEvent extends InternalEvent {
  jobId?: string;
  error: {
    message: string;
    type: string;
    severity: string;
  };
}

export type EventMap = {
  [WORKFLOW_START]: WorkflowStartEvent;
  [WORKFLOW_COMPLETE]: WorkflowCompleteEvent;
  [JOB_START]: JobStartEvent;
  [JOB_COMPLETE]: JobCompleteEvent;
  [JOB_ERROR]: JobErrorEvent;
  [LOG]: LogEvent;
  [ERROR]: ErrorEvent;

  // TODO - extra events that aren't really designed yet
  ['worker:init-start']: any;
  ['worker:init-complete']: any;
  ['worker:load-state']: any;
};

export type WorkerEvents = keyof EventMap;
