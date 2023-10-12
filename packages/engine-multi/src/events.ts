// TODO remove ths file in favour of types

// TODO mayberename event constants
import { JSONLog } from '@openfn/logger';

// Top level API events - these are what the engine publishes externally
// should it just be start, log, job-start, job-complete, end etc?
// What about engine-level logging? CLI-level stuff?
export const WORKFLOW_START = 'workflow-start';

export const WORKFLOW_COMPLETE = 'workflow-complete';

export const WORKFLOW_ERROR = 'workflow-error';

export const WORKFLOW_LOG = 'workflow-log';

// Internal runtime events - these are what the worker thread publishes
// to the engine

type State = any; // TODO

export type AcceptWorkflowEvent = {
  type: typeof WORKFLOW_START;
  workflowId: string;
  threadId: number;
};

export type CompleteWorkflowEvent = {
  type: typeof WORKFLOW_COMPLETE;
  workflowId: string;
  state: State;
};

export type ErrWorkflowEvent = {
  type: typeof WORKFLOW_ERROR;
  workflowId: string;
  message: string;
};

export type LogWorkflowEvent = {
  type: typeof WORKFLOW_LOG;
  workflowId: string;
  message: JSONLog;
};

export type WorkflowEvent =
  | AcceptWorkflowEvent
  | CompleteWorkflowEvent
  | ErrWorkflowEvent;
//   | LogWorkflowEvent;
