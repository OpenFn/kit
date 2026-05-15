/**
 * Schema for portable representation of a Project
 * AKA Project Spec
 * Can serialize to JSON or YAML or whatever you like
 *
 * This interface describes the 4.0 Portability Spec: https://docs.openfn.org/documentation/deploy/portability
 *
 * If you serialize a v2 project file without state, this is what you get
 */

export interface ProjectSpec {
  /** Single-word identifier */
  id: string;

  /** human readable name */
  name?: string;

  description?: string;

  schema_version?: string;

  workflows: WorkflowSpec[];

  credentials?: Credential[];

  collections?: string[];
}

export interface WorkflowSpec {
  /** The primary internal identifier for a Workflow (not a UUID) */
  id?: string;

  /** Human readable label. Can be used to generate an internal id */
  name?: string;

  schema_version?: string;

  steps: Array<Job | Trigger>;

  /** Global functions (path to a js file, unsupported in app) */
  globals?: string;

  /** The default start node - the one the workflow was designed for (the trigger) */
  start?: string;

  /** extra options used to configure the workflow (unused?)*/
  options?: any;
}

export type StepId = string;

/**
 * A thing to be run as part of a workflow
 * (usually a job)
 */
export interface Step {
  // TODO a Step must ALWAYS have an id (util functions can default it)
  id?: StepId;
  name?: string; // user-friendly name used in logging

  // TODO remove next: string (next should always be an object)
  next?: string | Record<StepId, StepEdge>;
}

export type StepEdge = boolean | string | ConditionalStepEdge;

export type ConditionalStepEdge = {
  condition?: string; // Javascript expression (function body, not function)
  label?: string; // TODO this is probably the name
  disabled?: boolean;
};

export interface Trigger extends Step {
  type?: 'webhook' | 'cron' | 'kafka';

  /** cron schedule, only meaningful when type is 'cron' */
  cron_expression?: string;

  enabled?: boolean;

  webhook_reply?: 'before_start' | 'after_completion';
  webhook_response_config?: {
    error_code?: number;
    success_code?: number;
  };
  cron_cursor_job_id?: string;

  /** Allow arbitrary properties on trigger nodes (as configuration options) */
  [option: string]: any;
}

// TODO credential should just be an id string in the near future
export interface Credential {
  name: string;
  owner: string;
}

export interface Job extends Step {
  adaptor?: string;
  expression?: string;
  configuration?: object | string;
}
