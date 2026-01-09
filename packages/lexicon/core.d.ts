import { SanitizePolicies } from '@openfn/logger';
import type { RawSourceMap } from 'source-map';

/** UUID v4 (or numbers, when running in dev mode*/
export type UUID = string | number;

export type SourceMap = RawSourceMap;

export type SourceMapWithOperations = RawSourceMap & {
  operations: [{ line: number; order: number; name: string }];
};

// The serialised shape of of a project, as JSON
// this is what is saved to project.yaml
export type Project = {
  /** Single-word identifier */
  id: string;

  /** human readable name */
  name?: string;

  description?: string;

  workflows: Workflow[];

  options: {};

  credentials: any;
  collections: string[];

  // metadata about the app for sync
  openfn?: Partial<ProjectMeta>;

  config: WorkspaceConfig;

  /** Stuff only used by the CLI for this project */
  cli?: LocalMeta;
};

export interface LocalMeta {
  /* schema version. Must be at >= 2 for a new project file 
  This only affects how a state file ondisk is parsed */
  version?: number;
  /** Shorthand identifier used by CLI commands */
  alias?: string;
  [key: string]: any;
}

export interface OpenFnMetadata {
  uuid?: UUID;
}

type FileFormats = 'yaml' | 'json';

// This is the old workspace config file, up to 0.6
// TODO would like a better name than "Workspace File"
// Can't use config, it means something else (and not all of it is config!)
// State is good but overloaded
// Settings? Context?
export interface WorkspaceFileLegacy {
  workflowRoot: string;
  dirs: {
    workflows: string;
    projects: string;
  };
  formats: {
    openfn: FileFormats;
    project: FileFormats;
    workflow: FileFormats;
  };

  // TODO this isn't actually config - this is other stuff
  name: string;
  project: {
    projectId: string;
    endpoint: string;
    env: string;
    inserted_at: string;
    updated_at: string;
  };
}

// Structure of the new openfn.yaml file
export interface WorkspaceFile {
  workspace: WorkspaceConfig;
  project: ProjectMeta;
}

export interface WorkspaceConfig {
  dirs: {
    workflows: string;
    projects: string;
  };
  formats: {
    openfn?: FileFormats;
    project?: FileFormats;
    workflow?: FileFormats;
  };
}

// Metadata about a connected OpenFn Project
export interface ProjectMeta {
  uuid?: UUID;
  endpoint?: string;
  env?: string;
  inserted_at?: string;
  updated_at?: string;

  [key: string]: unknown;
}

export interface WorkflowMeta {
  uuid?: UUID;
  lock_version?: number;

  [key: string]: unknown;
}

export interface NodeMeta {
  uuid?: UUID;

  [key: string]: unknown;
}

/**
 * An execution plan is a portable definition of a Work Order,
 * or, a unit of work to execute
 * This definition represents the external format - the shape of
 * the plan pre-compilation before it's passed into the runtime manager
 * (ie, the CLI or Worker)
 */
export type ExecutionPlan = {
  id?: UUID; // TODO make required
  workflow: Workflow;
  options?: WorkflowOptions;
};

/**
 * A workflow is just a series of steps, executed start to finish
 */
export type Workflow = {
  /** The ID is the primary internal identifier for a Workflow */
  id?: string;

  /** Human readable name, like display. Can be used to generate an internal id */
  name?: string;

  /** Local shorthand name for use in CLI commands. Not used by Lightning */
  alias?: string;

  steps: Array<Job | Trigger>;

  // global credentials
  // (gets applied to every configuration object)
  credentials?: Record<string, any>;

  // a path to a file where functions are defined
  globals?: string;

  openfn?: WorkflowMeta;

  // holds history information of a workflow
  history?: string[];

  /** The default start node - the one the workflow was designed for (the trigger) */
  start?: string;
};

export type StepId = string;

/**
 * A thing to be run as part of a workflow
 * (usually a job)
 */
export interface Step {
  // TODO a Step must ALWAYS have an id (util functions can default it)
  id?: StepId;
  name?: string; // user-friendly name used in logging

  next?: string | Record<StepId, StepEdge>;
  previous?: StepId;
}

/**
 * Not actually keen on the node/edge semantics here
 * Maybe StepLink?
 */
export type StepEdge = boolean | string | ConditionalStepEdge;

export type ConditionalStepEdge = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string; // TODO this is probably the name
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

/**
 * A type of Step which executes code
 * This is some openfn expression plus metadata (adaptor, credentials)
 */
export interface Job extends Step {
  adaptors?: string[];
  expression?: Expression;
  configuration?: object | string;
  state?: Omit<State, 'configuration'> | string;

  sourceMap?: SourceMapWithOperations;

  // Internal use only
  // Allow module paths and versions to be overridden in the linker
  // Maps to runtime.ModuleInfoMap
  linker?: Record<
    string,
    {
      path?: string;
      version?: string;
    }
  >;
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
  errors?: Record<StepId, SerializedError>;

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
  end?: StepId;

  // TODO not supported yet I don't think?
  sanitize?: SanitizePolicies;
};

/**
 * This is what serialized error objects should look like
 * This is not well enforced right now
 */
export type SerializedError = {
  source: string;
  name: string;
  severity: string;
  message: string;
  details: any;

  stack?: string;
  position?: string;
};

/**
 * @deprecated
 */
export type ErrorReport = {
  type: string; // The name/type of error, ie Error, TypeError
  message: string; // simple human readable message
  stepId: StepId; // ID of the associated job
  error: Error; // the original underlying error object

  code?: string; // The error code, if any (found on node errors)
  stack?: string; // not sure this is useful?
  data?: any; // General store for related error information
};

// TODO standard shape of error object in our stack

export type Lazy<T> = T | string;
