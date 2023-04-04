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
export type JobPlanID = string;
export type RuntimeExecutionPlanID = string;

// TODO this type should later be imported from the runtime
export type JobPlan = {
  id?: string;

  // Oh that's interesting! A compiled job doesn't have an adaptor, it just has a bunch of imports
  // So the CLI will need to handle compilation for every expression in a job plan.
  // adaptor: string;

  expression: string; // the code we actually want to execute. Could be lazy loaded
  configuration?: string | object; // credential can be inline or lazy loaded
  data?: State['data']; // initial state

  // If no upstream, execute the next in the array
  // This might not make sense in branching flows?
  // How would we say "onsuccess: return"?
  upstream?:
    | JobPlanID // shorthand for { default }
    | {
        success: JobPlanID;
        error: JobPlanID;
        default: JobPlanID;
      };
};

// A runtime manager execution plan
export type ExecutionPlan = {
  id?: string; // UUID for this plan

  // should we save the initial and resulting status?
  // Should we have a status here, is this a living thing?

  jobs: JobPlan[]; // TODO this type should later be imported from the runtime
};

export type JobModule = {
  operations: Operation[];
  execute?: (...operations: Operation[]) => (state: any) => any;
  // TODO lifecycle hooks
};
