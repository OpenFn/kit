/**
 * Typings which define the Portability Spec
 * See https://docs.openfn.org/documentation/deploy/portability
 */

/**
 * Schema for portable representation of a Project
 * AKA Project Spec
 * Can serialize to JSON or YAML or whatever you like
 *
 * If you serialize a v2 project file without state, this is what you get
 */
export interface ProjectSpec {
  /** Single-word identifier */
  id: string;

  /** human readable name */
  name?: string;

  description?: string;

  workflows: WorkflowSpec[];

  credentials?: Credential[];

  collections?: string[];
}

export interface WorkflowSpec {
  /** The primary internal identifier for a Workflow (not a UUID) */
  id?: string;

  /** Human readable label. Can be used to generate an internal id */
  name?: string;

  steps: Array<Job | Trigger>;

  // a path to a file where functions are defined
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
export interface Trigger extends Step {
  enabled?: boolean;

  // TODO a trigger supports many more keys which the
  // spec must support
}

// TODO credential should just be an id string in the near future
export interface Credential {
  name: string;
  owner: string;
}

/**
 * A type of Step which executes code
 * This is some openfn expression plus metadata (adaptor, credentials)
 */
export interface Job extends Step {
  adaptors?: string[];
  expression?: string;
  configuration?: object | string;
}
