import { JSONLog } from '@openfn/logger';

export const WORKFLOW_START = 'workflow-start';

export const WORKFLOW_COMPLETE = 'workflow-complete';

export const WORKFLOW_ERROR = 'workflow-error';

export const WORKFLOW_LOG = 'workflow-log';

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

export type WorkflowLogEvent = {
  type: typeof WORKFLOW_LOG;
  workflowId: string;
  message: JSONLog;
};

export type WorkflowEvent =
  | AcceptWorkflowEvent
  | CompleteWorkflowEvent
  | ErrWorkflowEvent
  | WorkflowLogEvent;
