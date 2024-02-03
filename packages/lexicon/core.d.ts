/**
 * An execution plan is a portable definition of a Work Order,
 * or, a unit of work to execute
 */
export type ExecutionPlan = {
  id?: UUID; // this would be the run (nee attempt) id
  workflow: Workflow;
  options: WorkflowOptions;
};

/**
 * A workflow is just a series of steps, executed start to finish
 */
export type Workflow = {
  id?: UUID; // unique id used to track this workflow. Could be autogenerated

  // TODO: make required (worker and cli may have to generate a name)
  name?: string;

  steps: Array<Job | Trigger>;
};

/**
 * A type of Step which executes code
 * This is some openfn expression plus metadata (adaptor, credentials)
 */
export interface Job extends Step {
  adaptor?: string;
  expression: Expression;
  configuration?: object | string;
  state?: Omit<State, 'configuration'> | string;
}

/**
 * A raw openfn-js script to be executed by the runtime
 *
 * Can be compiled as part of a job.
 *
 * The expression itself has no metadata. It likely needs
 * an adaptor and input state to run
 */
export type Expression = string;

/**
 * State is an object passed into a workflow and returned from a workflow
 */
export declare interface State<S = object, C = object> {
  // Core state props used by the runtime
  configuration?: C;
  data?: S;
  errors?: Record<StepId, ErrorReport>;

  // Props added by common
  references?: Array<any>;

  // Props commonly used by other adaptors
  index?: number;
  response?: any;
  query?: any;

  [other: string]: any;
}

/**
 * An operation function that runs in an Expression
 */
export declare interface Operation<T = Promise<State> | State> {
  (state: State): T;
}

/**
 * Options which can be set on a workflow as part of an execution plan
 */
export type WorkflowOptions = {
  // TODO Both numbers in minutes maybe
  timeout?: number;
  stepTimeout?: number;

  start?: StepId;
  statePropsToRemove?: string[];
};

export type StepId = string;

/**
 * A thing to be run as part of a workflow
 * (usually a job)
 */
export interface Step {
  id?: StepId;
  name?: string; // user-friendly name used in logging

  next?: string | Record<StepId, StepEdge>;
  previous?: StepId;
}

/**
 * Not actually keen on the node/edge semantics here
 * Maybe StepLink?
 */
export type StepEdge =
  | boolean
  | string
  | {
      condition?: string; // Javascript expression (function body, not function)
      label?: string;
      disabled?: boolean;
    };

/**
 * A no-op type of Step
 */
export interface Trigger extends Step {}

/**
 * An expression which has been compiled, and so includes import and export statements
 */
export type CompiledExpression = Expression;

export type ErrorReport = {
  type: string; // The name/type of error, ie Error, TypeError
  message: string; // simple human readable message
  stepId: StepId; // ID of the associated job
  jobId?: StepId; // deprecated
  error: Error; // the original underlying error object

  code?: string; // The error code, if any (found on node errors)
  stack?: string; // not sure this is useful?
  data?: any; // General store for related error information
};

// TODO standard shape of error object in our stack

type UUID = string;

export type Lazy<T> = T | string;
