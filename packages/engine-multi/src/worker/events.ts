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

export interface JobStartEvent extends InternalEvent {}

export interface JobCompleteEvent extends InternalEvent {}

export interface LogEvent extends InternalEvent {
  message: JSONLog;
}

// TODO not really sure what errors look like yet
export interface ErrorEvent extends InternalEvent {
  [key: string]: any;
}

export type EventMap = {
  [WORKFLOW_START]: WorkflowStartEvent;
  [WORKFLOW_COMPLETE]: WorkflowCompleteEvent;
  [JOB_START]: JobStartEvent;
  [JOB_COMPLETE]: JobCompleteEvent;
  [LOG]: LogEvent;
  [ERROR]: ErrorEvent;
};

export type WorkerEvents = keyof EventMap;
