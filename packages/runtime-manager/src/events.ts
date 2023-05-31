export const ACCEPT_JOB = 'accept-job';

export const COMPLETE_JOB = 'complete-job';

export const JOB_ERROR = 'job-error';

type State = any; // TODO

export type AcceptJobEvent = {
  type: typeof ACCEPT_JOB;
  jobId: string;
  threadId: number;
};

export type CompleteJobEvent = {
  type: typeof COMPLETE_JOB;
  jobId: string;
  state: State;
};

export type ErrJobEvent = {
  type: typeof JOB_ERROR;
  jobId: string;
  message: string;
};

export type JobEvent = AcceptJobEvent | CompleteJobEvent | ErrJobEvent;
