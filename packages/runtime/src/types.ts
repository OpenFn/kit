import type { Logger } from '@openfn/logger';
import type { LinkerOptions } from './modules/linker';

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

export type Options = {
  logger?: Logger;
  jobLogger?: Logger;

  timeout?: number;

  // Treat state as immutable (likely to break in legacy jobs)
  immutableState?: boolean;

  // TODO currently unused
  // Ensure that all incoming jobs are sandboxed / loaded as text
  // In practice this means throwing if someone tries to pass live js
  forceSandbox?: boolean;

  linker?: LinkerOptions;
};

// TODO these are copied from rtm-server but they probably belong here no?
export type JobNodeID = string;
export type RuntimeExecutionPlanID = string;

export type JobEdge = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string;
  acceptError?: boolean; // maybe
};

// Discard label information that we don't need here
export type CompiledJobEdge = {
  condition?: Function;
};

export type JobNode = {
  id?: string;
  // The runtime itself will ignore the adaptor flag
  // The adaptor import should be compiled in by the compiler, and dependency managed by the runtime manager
  adaptor?: string;

  expression?: string | Operation[]; // the code we actually want to execute. Could be lazy loaded
  configuration?: object; // credential object
  data?: State['data']; // initial state (globals)

  next?: string | Record<JobNodeID, true | JobEdge>;
};

export type CompiledJobNode = Omit<JobNode, 'next'> & {
  next?: Record<JobNodeID, CompiledJobEdge>;
};

export type ExecutionPlan = {
  id?: string; // UUID for this plan
  start?: JobNodeID;
  jobs: JobNode[];
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
