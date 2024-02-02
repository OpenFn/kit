import {
  State,
  Operation,
  Job,
  StepId,
  WorkflowOptions,
} from '@openfn/lexicon';

import { Logger } from '@openfn/logger';
import { Options } from './runtime';
import { ErrorReporter } from './util/log-error';
import {
  NOTIFY_INIT_COMPLETE,
  NOTIFY_JOB_COMPLETE,
  NOTIFY_JOB_ERROR,
  NOTIFY_JOB_START,
  NOTIFY_INIT_START,
  NOTIFY_STATE_LOAD,
} from './events';

export type CompiledJobEdge =
  | boolean
  | {
      condition?: Function;
      disabled?: boolean;
    };

export type CompiledJobNode = Omit<Job, 'next'> & {
  id: StepId;
  next?: Record<StepId, CompiledJobEdge>;
};

export type Lazy<T> = string | T;

export type CompiledExecutionPlan = {
  workflow: {
    jobs: Record<StepId, CompiledJobNode>;
  };
  options: WorkflowOptions & {
    start: StepId;
  };
};

export type JobModule = {
  operations: Operation[];
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
};

type NotifyHandler = (
  event: NotifyEvents,
  payload: NotifyEventsLookup[typeof event]
) => void;

export type ExecutionContext = {
  plan: CompiledExecutionPlan;
  logger: Logger;
  opts: Options;
  report: ErrorReporter;
  notify: NotifyHandler;
};

export type NotifyEvents =
  | typeof NOTIFY_INIT_START
  | typeof NOTIFY_INIT_COMPLETE
  | typeof NOTIFY_JOB_START
  | typeof NOTIFY_JOB_COMPLETE
  | typeof NOTIFY_JOB_ERROR
  | typeof NOTIFY_STATE_LOAD;

export type NotifyJobInitStartPayload = {
  jobId: string;
};

export type NotifyJobInitCompletePayload = {
  duration: number;
  jobId: string;
};

export type NotifyJobCompletePayload = {
  duration: number;
  state: any;
  jobId: string;
  next: string[];
  mem: {
    job: number;
    system: number;
  };
};

export type NotifyJobErrorPayload = {
  duration: number;
  error?: any; // TODO I should be able to do better than this because I have a standard error interface
  state: any;
  jobId: string;
  next: string[];
};

export type NotifyJobStartPayload = {
  jobId: string;
};

export type NotifyStateLoadPayload = {
  jobId: string;
  duration: number;
};

export type NotifyEventsLookup = {
  [NOTIFY_INIT_START]: NotifyJobInitStartPayload;
  [NOTIFY_INIT_COMPLETE]: NotifyJobInitCompletePayload;
  [NOTIFY_JOB_START]: NotifyJobStartPayload;
  [NOTIFY_JOB_COMPLETE]: NotifyJobCompletePayload;
  [NOTIFY_JOB_ERROR]: NotifyJobErrorPayload;
  [NOTIFY_STATE_LOAD]: NotifyStateLoadPayload;
};

export type ExecutionCallbacks = {
  notify?: NotifyHandler;
  resolveState?: (stateId: string) => Promise<any>;
  resolveCredential?: (credentialId: string) => Promise<any>;
};
