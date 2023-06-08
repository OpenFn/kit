// TMP just thinking through things
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

export declare interface State<D = object, C = object> {
  configuration?: C;
  data?: D;
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
  start?: JobNodeID;
  jobs: JobNode[];
};

export type JobNode = {
  id?: string;

  // The runtime itself will ignore the adaptor flag
  // The adaptor import should be compiled in by the compiler, and dependency managed by the runtime manager
  adaptor?: string;

  expression?: string | Operation[]; // the code we actually want to execute. Can be a path.

  configuration?: object; // credential object
  data?: State['data']; // default state (globals)

  next?: Record<JobNodeID, boolean | JobEdge>;
  previous?: JobNodeID;
};

export type JobEdge = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string;
};

export type JobNodeID = string;

// Discard label information that we don't need here
export type CompiledJobEdge = {
  condition?: Function;
};

export type CompiledJobNode = Omit<JobNode, 'next'> & {
  next?: Record<JobNodeID, CompiledJobEdge>;
};

export type CompiledExecutionPlan = {
  id?: string;
  start: JobNodeID;
  jobs: Record<JobNodeID, CompiledJobNode>;
};

export type JobModule = {
  operations: Operation[];
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
};
