import { Provisioner } from '@openfn/lexicon/lightning';

export type StateJob = Provisioner.Job;

export type SpecJobBody =
  | string
  | {
      path?: string;
      content: string;
    };

export type SpecJob = Omit<
  Provisioner.Job,
  'id' | 'body' | 'project_credential_id' | 'keychain_credential_id' | 'delete'
> & {
  id?: string;
  body: SpecJobBody;
  credential: string | null;
};

export type StateTrigger = Provisioner.Trigger;

export type SpecTrigger = Omit<Provisioner.Trigger, 'id'>;

export type StateKafkaHost = [string, string];

export type StateKafkaConfiguration = Provisioner.KafkaConfiguration;

export type SpecKafkaConfiguration = Omit<
  Provisioner.KafkaConfiguration,
  'hosts'
> & {
  hosts: string[];
};

export type StateEdge = Provisioner.Edge;

export type SpecEdge = Omit<
  Provisioner.Edge,
  | 'id'
  | 'condition_expression'
  | 'condition_label'
  | 'source_job_id'
  | 'source_trigger_id'
  | 'target_job_id'
> & {
  condition_expression: string | null;
  condition_label: string | null;
  source_job?: string | null;
  source_trigger?: string | null;
  target_job: string | null;
};

export type CredentialState = Provisioner.Credential;

export type CredentialSpec = Omit<Provisioner.Credential, 'id'>;

export type CollectionState = Provisioner.Collection;

export type CollectionSpec = Omit<Provisioner.Collection, 'id' | 'delete'>;

export interface WorkflowState
  extends Omit<
    Provisioner.Workflow,
    'jobs' | 'triggers' | 'edges' | 'deleted_at'
  > {
  jobs: Record<string | symbol, Concrete<StateJob>>;
  triggers: Record<string | symbol, Concrete<StateTrigger>>;
  edges: Record<string | symbol, Concrete<StateEdge>>;
  deleted_at?: string | null;
}

export type WorkflowSpec = Omit<
  Provisioner.Workflow,
  | 'id'
  | 'jobs'
  | 'triggers'
  | 'edges'
  | 'delete'
  | 'project_id'
  | 'version_history'
  | 'concurrency'
  | 'lock_version'
  | 'inserted_at'
  | 'updated_at'
  | 'deleted_at'
> & {
  id?: string;
  jobs?: Record<string | symbol, SpecJob>;
  triggers?: Record<string | symbol, SpecTrigger>;
  edges?: Record<string | symbol, SpecEdge>;
};

export interface ProjectState
  extends Omit<
    Provisioner.Project,
    | 'description'
    | 'workflows'
    | 'project_credentials'
    | 'collections'
    | 'scheduled_deletion'
    | 'history_retention_period'
    | 'dataclip_retention_period'
  > {
  description: string;
  workflows: Record<string | symbol, WorkflowState>;
  project_credentials: Record<string | symbol, CredentialState>;
  collections: Record<string | symbol, CollectionState>;
  scheduled_deletion?: string | null;
  history_retention_period?: string | null;
  dataclip_retention_period?: string | null;
}

export interface ProjectSpec
  extends Omit<
    Provisioner.Project,
    | 'id'
    | 'description'
    | 'workflows'
    | 'project_credentials'
    | 'collections'
    | 'inserted_at'
    | 'updated_at'
    | 'scheduled_deletion'
    | 'history_retention_period'
    | 'dataclip_retention_period'
    | 'parent_id'
  > {
  description: string;
  workflows: Record<string | symbol, WorkflowSpec>;
  credentials: Record<string | symbol, CredentialSpec>;
  collections: Record<string | symbol, CollectionSpec>;
}

export interface ProjectPayload {
  id: string;
  name: string;
  description: string;
  collections?: Concrete<CollectionState>[];
  project_credentials: Concrete<CredentialState>[];
  workflows: {
    id: string;
    name: string;
    project_id?: string;
    jobs: Concrete<StateJob>[];
    triggers: Concrete<StateTrigger>[];
    edges: Concrete<StateEdge>[];
  }[];
}

type Concrete<Type> = Type & { id: string };

export interface DeployConfig {
  configPath?: string;
  specPath: string;
  statePath: string;
  endpoint: string;
  requireConfirmation: boolean;
  dryRun: boolean;
  apiKey: string | null;
}
