export const WORKFLOW_START = 'workflow-start';

export const WORKFLOW_COMPLETE = 'workflow-complete';

export const WORKFLOW_ERROR = 'workflow-error';

export const JOB_LOG = 'job-log';

type State = any; // TODO

export type AcceptWorkflowEvent = {
  type: typeof WORKFLOW_START;
  jobId: string;
  threadId: number;
};

export type CompleteWorkflowEvent = {
  type: typeof WORKFLOW_COMPLETE;
  jobId: string;
  state: State;
};

export type ErrWorkflowEvent = {
  type: typeof WORKFLOW_ERROR;
  jobId: string;
  message: string;
};

export type JobLogEvent = {
  type: typeof JOB_LOG;
  jobId: string;
  message: any; // TOD JSONLOG
};

export type WorkflowEvent =
  | AcceptWorkflowEvent
  | CompleteWorkflowEvent
  | ErrWorkflowEvent
  | JobLogEvent;
