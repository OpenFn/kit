import { SanitizePolicies } from '@openfn/logger';
import type { RawSourceMap } from 'source-map';

import { Credential, Job, ProjectSpec, WorkflowSpec } from './portability';
export {
  Step,
  Job,
  Trigger,
  StepEdge,
  ConditionalStepEdge,
  Credential,
  WorkflowSpec,
} from './portability';

/**
 * Canonical internal stateful Project representation.
 * This is what gets serialized in a v2 <alias>@<domain>.yaml file
 */
export interface ProjectState extends WithState<ProjectSpec, ProjectMeta> {
  // override Workflows to include state
  workflows: WorkflowState[];

  options?: {
    env?: string;
    color?: string;

    [key: string]: any;
  };

  sandbox?: SandboxMeta;

  config: WorkspaceConfig;

  credentials?: Array<CredentialState>;

  /** Stuff only used by the CLI for this project */
  cli?: LocalMeta;
}

export interface WorkflowState extends WithState<WorkflowSpec, WorkflowMeta> {
  /** holds version history information of a workflow **/
  history?: string[];

  /** global credentials (gets applied to every configuration object) */
  credentials?: Record<string, any>;
}

export interface JobState extends Job {
  /** Some of this stuff is more like internal runtime options and needs moving */

  state?: Omit<State, 'configuration'> | string;

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

/** UUID v4 (or numbers, when running in dev mode*/
export type UUID = string | number;

export type SourceMap = RawSourceMap;

export type SourceMapWithOperations = RawSourceMap & {
  operations: [{ line: number; order: number; name: string }];
};

export type SandboxMeta = {
  parentId?: string;
  parentName?: string; // not supported yet
  [key: string]: any;
};

/**
 * Utility to append a .openfn state object to
 * another object
 */
export type WithState<P, S = {}> = P & {
  openfn?: {
    uuid?: UUID;
    [key: string]: any;
  } & S;
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

export interface CredentialState extends Credential {
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
  credentials?: string;
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
  forked_from?: Record<string, string>;

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
