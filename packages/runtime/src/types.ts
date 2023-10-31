// TMP just thinking through things

import { Logger } from '@openfn/logger';
import { Options } from './runtime';
import { ErrorReporter } from './util/log-error';

// I dont think this is useufl? We can just use error.name of the error object
export type ErrorTypes =
  | 'AdaptorNotFound' // probably a CLI validation thing
  | 'PackageNotFound' // Linker failed to load a dependency
  | 'ExpressionTimeout' // An expression (job) failed to return before the timeout
  | 'AdaptorException' //  Bubbled out of adaptor code
  | 'RuntimeException'; // Caused by an exception in a job. JobException? What about "expected" errors from adaptors?

export type ErrorReport = {
  name: string; // The name/type of error, ie Error, TypeError
  message: string; // simple human readable message
  jobId: JobNodeID; // ID of the associated job
  error: Error; // the original underlying error object

  code?: string; // The error code, if any (found on node errors)
  stack?: string; // not sure this is useful?
  data?: any; // General store for related error information
};

export declare interface State<S = object, C = object> {
  configuration?: C;
  state?: S;
  references?: Array<any>;
  index?: number;

  // New error capture object
  // Synonyms: exceptions, problems, issues, err, failures
  errors?: Record<JobNodeID, ErrorReport>;

  // Legacy error property from old platform
  // Adaptors may use this?
  error?: any[];

  // Note that other properties written to state may be lost between jobs
  [other: string]: any;
}

export declare interface Operation<T = Promise<State> | State> {
  (state: State): T;
}

export type ExecutionPlan = {
  id?: string; // UUID for this plan
  jobs: JobNode[];
  start?: JobNodeID;
  initialState?: State | string;
};

export type JobNode = {
  id?: JobNodeID;

  // The runtime itself will ignore the adaptor flag
  // The adaptor import should be compiled in by the compiler, and dependency managed by the runtime manager
  adaptor?: string;

  expression?: string | Operation[]; // the code we actually want to execute. Can be a path.

  configuration?: object | string; // credential object

  // TODO strings aren't actually suppored here yet
  state?: Omit<State, 'configuration'> | string; // default state (globals)

  next?: string | Record<JobNodeID, JobEdge>;
  previous?: JobNodeID;
};

export type JobEdge =
  | boolean
  | string
  | {
      condition?: string; // Javascript expression (function body, not function)
      label?: string;
      disabled?: boolean;
    };

export type JobNodeID = string;

export type CompiledJobEdge =
  | boolean
  | {
      condition?: Function;
      disabled?: boolean;
    };

export type CompiledJobNode = Omit<JobNode, 'next'> & {
  id: JobNodeID;
  next?: Record<JobNodeID, CompiledJobEdge>;
};

export type CompiledExecutionPlan = {
  id?: string;
  start: JobNodeID;
  jobs: Record<JobNodeID, CompiledJobNode>;
  initialState?: State | string;
};

export type JobModule = {
  operations: Operation[];
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
};

// TODO difficulty: this is not the same as a vm execution context
export type ExecutionContext = {
  plan: CompiledExecutionPlan;
  logger: Logger;
  opts: Options;
  report: ErrorReporter;
  notify: (evt: NotifyEvents, payload?: any) => void;
};

// External notifications to reveal what's happening
// All are passed through the notify handler
// TODO I'd prefer to load the strings from notify.ts and reflect the types here
export type NotifyEvents =
  | 'init-start' // The job is being initialised (ie, credentials lazy-loading)
  | 'init-complete'
  | 'job-start'
  | 'job-complete'
  | 'load-state';
// module-load

// I'm not wild about the callbacks pattern, events would be simpler
// but a) the resolvers MUST be a callback and b) we don't currently have an event emitter API
// no, ok, we're going to have a notify function which does the callbacks
export type ExecutionCallbacks = {
  notify?(event: NotifyEvents, payload: any): void;
  resolveState?: (stateId: string) => Promise<any>;
  resolveCredential?: (credentialId: string) => Promise<any>;
};
