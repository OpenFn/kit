import {
  Operation,
  SourceMapWithOperations,
  State,
  UUID,
  WorkflowOptions,
} from '@openfn/lexicon';
import { Logger } from '@openfn/logger';
import { Options } from './runtime';
import type { ErrorReporter } from './util/log-error';
import {
  NOTIFY_INIT_COMPLETE,
  NOTIFY_JOB_COMPLETE,
  NOTIFY_JOB_ERROR,
  NOTIFY_JOB_START,
  NOTIFY_INIT_START,
  NOTIFY_STATE_LOAD,
} from './events';
import { ModuleInfoMap } from './modules/linker';

export type StepId = string;

export type ConditionalStepEdge = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string;
  disabled?: boolean;
};

export type StepEdge = boolean | string | ConditionalStepEdge;

export interface Step {
  id?: StepId;
  name?: string;
  next?: string | Record<StepId, StepEdge>;
  previous?: StepId;
}

export interface Trigger extends Step {
  enabled?: boolean;

  // The trigger is allowed extra keys, but they will be ignored
  [key: string]: unknown;
}

export interface Job extends Step {
  // Spec-compliant props
  expression?: string;
  configuration?: object | string;

  // internal runtime props
  adaptors?: string[];
  state?: Omit<State, 'configuration'> | string;
  sourceMap?: SourceMapWithOperations;
  linker?: ModuleInfoMap;
}

// Runtime-internal mirror of the portability schema. Adds runtime-only
// fields (linker, sourceMap, adaptors[], state, etc) that aren't portable.
export interface Workflow {
  // Spec-compliant props
  id?: string;
  name?: string;
  steps: Array<Job | Trigger>;
  globals?: string;
  start?: StepId;

  // internal runtime props
  credentials?: Record<string, any>;
}

export type ExecutionPlan = {
  id?: UUID;
  workflow: Workflow;
  options?: WorkflowOptions;
};

export type CompiledEdge =
  | boolean
  | {
      condition?: Function;
      disabled?: boolean;
    };

export type CompiledStep = Omit<Step, 'next'> & {
  id: StepId;
  next?: Record<StepId, CompiledEdge>;
  previous?: StepId;
  linker?: ModuleInfoMap;

  [other: string]: any;
};

export interface CompiledWorkflow {
  globals?: string;
  steps: Record<StepId, CompiledStep>;
  sourceMap?: SourceMapWithOperations;
  credentials?: Record<string, any>;
  start?: StepId;
}

export type CompiledExecutionPlan = {
  id?: UUID;
  workflow: CompiledWorkflow;
  options: WorkflowOptions & {
    start: StepId;
  };
};

export type Lazy<T> = string | T;

export type ErrorPosition = {
  line: number;
  column: number;
  src?: string; // the source line for this error
};

export type ErrorReport = {
  type: string; // The name/type of error, ie Error, TypeError
  message: string; // simple human readable message
  stepId: StepId; // ID of the associated job
  error: Error; // the original underlying error object

  code?: string; // The error code, if any (found on node errors)
  stack?: string;
  data?: any;
};

export type JobModule = {
  operations: Operation[];
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
};

export type GlobalsModule = Record<string, any>;

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
    peak?: number;
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
