export declare interface State<D = object, C = object> {
  configuration?: C;
  data?: D;
  references?: Array<any>;
  index?: number;

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

  next?: string | Record<JobNodeID, true | JobEdge>;
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
