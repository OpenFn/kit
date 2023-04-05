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

type JobEdgeObject = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string;
  acceptError: boolean; // maybe
};

type JobEdge = true | JobEdgeObject;

type CompiledJobEdge =
  | true
  | (JobEdgeObject & {
      condition?: Function;
    });

// TODO this type should later be imported from the runtime
export type JobNode = {
  // Oh that's interesting! A compiled job doesn't have an adaptor, it just has a bunch of imports
  // So the CLI will need to handle compilation for every expression in a job plan.
  // But the CLI Workflow and Lightning Attempt WILL have an adaptor here
  // adaptor: string;

  expression: string | Operation[]; // the code we actually want to execute. Could be lazy loaded
  configuration?: object; // credential object
  data?: State['data']; // initial state (globals)

  next?: Record<JobNodeID, JobEdge>;

  // // If no upstream, execute the next in the array
  // // This might not make sense in branching flows?
  // // How would we say "onsuccess: return"?
  // upstream?:
  //   | JobNodeID // shorthand for { default }
  //   | {
  //       success: JobNodeID;
  //       error: JobNodeID;
  //       default: JobNodeID;
  //     };
};

export type CompiledJobNode = JobNode & {
  next?: Record<JobNodeID, CompiledJobEdge>;
};

// A runtime manager execution plan
export type ExecutionPlan = {
  id?: string; // UUID for this plan
  start: JobNodeID;
  precondition: string;
  // should we save the initial and resulting status?
  // Should we have a status here, is this a living thing?

  jobs: Record<JobNodeID, JobNode>; // TODO this type should later be imported from the runtime
};

export type CompiledExecutionPlan = ExecutionPlan & {
  precondition: Function;
  jobs: Record<JobNodeID, CompiledJobNode>;
};

export type JobModule = {
  operations: Operation[];
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
};
